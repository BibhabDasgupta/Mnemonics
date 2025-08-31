# --- File: app/services/restoration_limit_service.py ---
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.models.user import Account, Transaction, AppData

logger = logging.getLogger(__name__)

class RestorationLimitService:
    """Service for managing post-restoration transaction limits"""
    
    # Constants
    RESTORATION_LIMIT_HOURS = 35
    DEFAULT_RESTORATION_LIMIT = Decimal('5000.00')  # 5000 INR
    
    @classmethod
    def activate_restoration_limits(cls, db: Session, customer_id: str, limit_amount: Optional[Decimal] = None) -> bool:
        """
        Activate restoration limits for an account after restoration
        
        Args:
            db: Database session
            customer_id: Customer ID 
            limit_amount: Custom limit amount (defaults to 5000 INR)
            
        Returns:
            bool: True if limits were activated successfully
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                logger.warning(f"AppData not found for restoration limits: {customer_id}")
                return False
            
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=cls.RESTORATION_LIMIT_HOURS)
            
            app_data.last_restored_at = now
            app_data.is_restoration_limited = True
            app_data.restoration_daily_limit = limit_amount or cls.DEFAULT_RESTORATION_LIMIT
            app_data.restoration_limit_expires_at = expires_at
            app_data.updated_at = now
            
            db.commit()
            
            logger.info(
                f"Restoration limits activated: customer={customer_id} limit={app_data.restoration_daily_limit} expires={expires_at}"
            )
            return True
            
        except Exception as e:
            logger.exception(f"Error activating restoration limits for {customer_id}: {e}")
            db.rollback()
            return False
    
    @classmethod
    def check_restoration_status(cls, db: Session, customer_id: str) -> Tuple[bool, Optional[Decimal], Optional[datetime]]:
        """
        Check if account is under restoration limits
        
        Returns:
            Tuple[is_limited, limit_amount, expires_at]
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return False, None, None
            
            # Check if limits have expired
            if app_data.is_restoration_limited and app_data.restoration_limit_expires_at:
                now = datetime.now(timezone.utc)
                if now >= app_data.restoration_limit_expires_at:
                    # Limits have expired, remove them
                    cls._remove_restoration_limits(db, app_data)
                    return False, None, None
            
            if app_data.is_restoration_limited:
                return True, app_data.restoration_daily_limit, app_data.restoration_limit_expires_at
            
            return False, None, None
            
        except Exception as e:
            logger.exception(f"Error checking restoration status for {customer_id}: {e}")
            return False, None, None
    
    @classmethod
    def validate_transaction_against_limits(cls, db: Session, customer_id: str, transaction_amount: Decimal) -> Tuple[bool, str]:
        """
        Validate if transaction is allowed under restoration limits
        
        Restoration limits work as:
        - Individual transaction limit ONLY: No single transaction > ₹5000
        - NO cumulative limit: Users can make unlimited transactions under ₹5000 each
        
        Args:
            db: Database session
            customer_id: Customer ID
            transaction_amount: Amount to transfer
            
        Returns:
            Tuple[is_allowed, message]
        """
        try:
            is_limited, limit_amount, expires_at = cls.check_restoration_status(db, customer_id)
            
            if not is_limited:
                return True, "No restoration limits active"
            
            # Only check individual transaction limit
            if transaction_amount > limit_amount:
                hours_remaining = cls._calculate_hours_remaining(expires_at)
                return False, (
                    f"Transaction amount ₹{transaction_amount} exceeds post-restoration limit of "
                    f"₹{limit_amount} per transaction. This limit expires in {hours_remaining:.1f} hours."
                )
            
            # Transaction is within individual limit - allow it
            hours_remaining = cls._calculate_hours_remaining(expires_at)
            return True, f"Transaction allowed (₹{transaction_amount} ≤ ₹{limit_amount} individual limit, {hours_remaining:.1f} hours remaining)"
            
        except Exception as e:
            logger.exception(f"Error validating restoration limits for {customer_id}: {e}")
            return False, "Unable to validate restoration limits"
    
    @classmethod
    def _remove_restoration_limits(cls, db: Session, app_data: AppData) -> None:
        """Remove expired restoration limits"""
        try:
            app_data.is_restoration_limited = False
            app_data.restoration_limit_expires_at = None
            app_data.updated_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"Restoration limits expired and removed: customer={app_data.customer_id}")
        except Exception as e:
            logger.exception(f"Error removing restoration limits: {e}")
            db.rollback()
    
    @classmethod
    def _get_restoration_period_transaction_total(cls, db: Session, customer_id: str) -> Decimal:
        """Get total SUCCESSFUL transaction amount since restoration was activated"""
        try:
            # Get account number from Account table using customer_id
            account = db.query(Account).filter(Account.customer_id == customer_id).first()
            if not account:
                logger.warning(f"Account not found for customer: {customer_id}")
                return Decimal('0.00')
            
            # Get restoration data from AppData table
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.last_restored_at:
                logger.debug(f"No restoration data found for customer: {customer_id}")
                return Decimal('0.00')
            
            # Only count SUCCESSFUL debit transactions since restoration was activated
            # Exclude: blocked transactions, fraud transactions, and non-debit types
            total = db.query(Transaction).filter(
                Transaction.account_number == account.account_number,
                Transaction.type == 'debit',  # Only debit transactions (money going out)
                Transaction.amount < 0,  # Debit transactions are negative
                Transaction.date >= app_data.last_restored_at,  # Only since restoration
                Transaction.is_fraud == False,  # Exclude fraud transactions
                # Note: type == 'debit' already excludes 'blocked' type transactions
            ).with_entities(
                func.sum(func.abs(Transaction.amount))
            ).scalar() or Decimal('0.00')
            
            logger.info(f"Restoration period successful transactions total for {customer_id}: ₹{total} (since {app_data.last_restored_at})")
            return Decimal(str(total))
            
        except Exception as e:
            logger.exception(f"Error calculating restoration period transaction total for {customer_id}: {e}")
            return Decimal('0.00')
    
    @classmethod
    def _get_daily_transaction_total(cls, db: Session, customer_id: str) -> Decimal:
        """Get total transaction amount in the last 24 hours - DEPRECATED, use _get_restoration_period_transaction_total"""
        # Keep this method for backward compatibility but redirect to restoration period method
        return cls._get_restoration_period_transaction_total(db, customer_id)
    
    @classmethod
    def _calculate_hours_remaining(cls, expires_at: Optional[datetime]) -> float:
        """Calculate hours remaining until limit expiry"""
        if not expires_at:
            return 0.0
        
        now = datetime.now(timezone.utc)
        if expires_at <= now:
            return 0.0
        
        delta = expires_at - now
        return delta.total_seconds() / 3600
    
    @classmethod
    def get_restoration_info(cls, db: Session, customer_id: str) -> dict:
        """Get detailed restoration limit information for display"""
        try:
            is_limited, limit_amount, expires_at = cls.check_restoration_status(db, customer_id)
            
            if not is_limited:
                return {
                    "is_limited": False,
                    "message": "No restoration limits active"
                }
            
            hours_remaining = cls._calculate_hours_remaining(expires_at)
            
            return {
                "is_limited": True,
                "limit_amount": float(limit_amount),
                "daily_used": None,  # No cumulative tracking
                "remaining_limit": float(limit_amount),  # Always the full limit per transaction
                "hours_remaining": hours_remaining,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "message": f"Post-restoration limits active: ₹{limit_amount} per transaction limit, expires in {hours_remaining:.1f} hours"
            }
            
        except Exception as e:
            logger.exception(f"Error getting restoration info: {e}")
            return {
                "is_limited": False,
                "error": "Unable to retrieve restoration information"
            }
    
    @classmethod
    def debug_restoration_transactions(cls, db: Session, customer_id: str) -> dict:
        """Debug method to inspect restoration status and recent transactions"""
        try:
            # Get account and restoration data
            account = db.query(Account).filter(Account.customer_id == customer_id).first()
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            
            if not account or not app_data:
                return {"error": "Account or app data not found"}
            
            # Get recent transactions for debugging
            recent_transactions = db.query(Transaction).filter(
                Transaction.account_number == account.account_number
            ).order_by(Transaction.date.desc()).limit(10).all()
            
            hours_remaining = cls._calculate_hours_remaining(app_data.restoration_limit_expires_at) if app_data.restoration_limit_expires_at else 0
            
            return {
                "customer_id": customer_id,
                "account_number": account.account_number,
                "restoration_status": {
                    "is_limited": app_data.is_restoration_limited,
                    "individual_transaction_limit": float(app_data.restoration_daily_limit),
                    "last_restored_at": app_data.last_restored_at.isoformat() if app_data.last_restored_at else None,
                    "expires_at": app_data.restoration_limit_expires_at.isoformat() if app_data.restoration_limit_expires_at else None,
                    "hours_remaining": hours_remaining
                },
                "recent_transactions": [
                    {
                        "id": t.id,
                        "date": t.date.isoformat(),
                        "type": t.type,
                        "amount": float(t.amount),
                        "description": t.description,
                        "is_fraud": t.is_fraud
                    }
                    for t in recent_transactions
                ],
                "note": "Restoration limits only apply to individual transactions (max ₹5000 each), not cumulative amounts"
            }
            
        except Exception as e:
            logger.exception(f"Error in debug_restoration_transactions: {e}")
            return {"error": str(e)}