# --- File: app/services/pin_verification_service.py ---
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from app.db.models.user import Account
from app.schemas.transactions import PinVerificationResponse

logger = logging.getLogger(__name__)

class PinVerificationService:
    """Service for ATM PIN verification with security features"""
    
    # Constants
    MAX_PIN_ATTEMPTS = 3
    LOCKOUT_DURATION_MINUTES = 30
    
    @classmethod
    def hash_pin(cls, pin: str) -> str:
        """Hash PIN using SHA-256 with salt for security"""
        salt = "atm_pin_salt_"
        return hashlib.sha256(f"{salt}{pin}".encode()).hexdigest()
    
    @classmethod
    def verify_pin(cls, db: Session, customer_id: str, provided_pin: str) -> PinVerificationResponse:
        """Verify ATM PIN with attempt tracking and lockout protection"""
        try:
            # Get customer account
            account = db.query(Account).filter(Account.customer_id == customer_id).first()
            if not account:
                logger.warning(f"PIN verification failed - account not found: {customer_id}")
                return PinVerificationResponse(
                    verified=False,
                    message="Account not found",
                    attempts_remaining=None
                )
            
            # Check if PIN is locked
            if cls._is_pin_locked(account):
                logger.warning(f"PIN verification blocked - account locked: {customer_id}")
                return PinVerificationResponse(
                    verified=False,
                    message=f"PIN locked due to too many failed attempts. Try again after {account.pin_locked_until}",
                    attempts_remaining=0,
                    locked_until=account.pin_locked_until
                )
            
            # Check if PIN is set
            if not account.atm_pin_hash:
                logger.warning(f"PIN verification failed - no PIN set: {customer_id}")
                return PinVerificationResponse(
                    verified=False,
                    message="ATM PIN not set for this account. Please contact your bank.",
                    attempts_remaining=None
                )
            
            # Verify PIN
            provided_pin_hash = cls.hash_pin(provided_pin)
            pin_correct = account.atm_pin_hash == provided_pin_hash
            
            if pin_correct:
                # PIN correct - reset attempts and unlock
                logger.info(f"PIN verification successful: {customer_id}")
                account.pin_attempts = 0
                account.pin_locked_until = None
                db.commit()
                
                return PinVerificationResponse(
                    verified=True,
                    message="PIN verified successfully",
                    attempts_remaining=cls.MAX_PIN_ATTEMPTS
                )
            else:
                # PIN incorrect - increment attempts
                account.pin_attempts += 1
                attempts_remaining = cls.MAX_PIN_ATTEMPTS - account.pin_attempts
                
                logger.warning(f"PIN verification failed - incorrect PIN: {customer_id} (attempt {account.pin_attempts})")
                
                if account.pin_attempts >= cls.MAX_PIN_ATTEMPTS:
                    # Lock PIN for security
                    account.pin_locked_until = datetime.now(timezone.utc) + timedelta(minutes=cls.LOCKOUT_DURATION_MINUTES)
                    db.commit()
                    
                    logger.warning(f"PIN locked due to too many attempts: {customer_id}")
                    return PinVerificationResponse(
                        verified=False,
                        message=f"Too many incorrect attempts. PIN locked for {cls.LOCKOUT_DURATION_MINUTES} minutes.",
                        attempts_remaining=0,
                        locked_until=account.pin_locked_until
                    )
                else:
                    db.commit()
                    return PinVerificationResponse(
                        verified=False,
                        message=f"Incorrect PIN. {attempts_remaining} attempts remaining.",
                        attempts_remaining=attempts_remaining
                    )
                    
        except Exception as e:
            logger.exception(f"PIN verification error for customer {customer_id}: {e}")
            db.rollback()
            return PinVerificationResponse(
                verified=False,
                message="PIN verification service temporarily unavailable",
                attempts_remaining=None
            )
    
    @classmethod
    def _is_pin_locked(cls, account: Account) -> bool:
        """Check if PIN is currently locked"""
        if not account.pin_locked_until:
            return False
        return datetime.now(timezone.utc) < account.pin_locked_until
    
    @classmethod
    def set_pin(cls, db: Session, customer_id: str, new_pin: str) -> bool:
        """Set or update ATM PIN for customer"""
        try:
            # Validate PIN format
            if not new_pin.isdigit() or not (4 <= len(new_pin) <= 6):
                logger.warning(f"Invalid PIN format for customer {customer_id}")
                return False
            
            # Get account
            account = db.query(Account).filter(Account.customer_id == customer_id).first()
            if not account:
                logger.warning(f"Account not found for PIN setup: {customer_id}")
                return False
            
            # Hash and store PIN
            account.atm_pin_hash = cls.hash_pin(new_pin)
            account.pin_attempts = 0  # Reset attempts
            account.pin_locked_until = None  # Clear any existing lockout
            
            db.commit()
            logger.info(f"PIN set successfully for customer: {customer_id}")
            return True
            
        except Exception as e:
            logger.exception(f"Error setting PIN for customer {customer_id}: {e}")
            db.rollback()
            return False

    @classmethod
    def reset_pin_attempts(cls, db: Session, customer_id: str) -> bool:
        """Reset PIN attempts (admin function)"""
        try:
            account = db.query(Account).filter(Account.customer_id == customer_id).first()
            if not account:
                return False
            
            account.pin_attempts = 0
            account.pin_locked_until = None
            db.commit()
            
            logger.info(f"PIN attempts reset for customer: {customer_id}")
            return True
            
        except Exception as e:
            logger.exception(f"Error resetting PIN attempts for customer {customer_id}: {e}")
            db.rollback()
            return False