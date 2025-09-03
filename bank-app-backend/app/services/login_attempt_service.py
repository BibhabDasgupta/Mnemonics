# Create new file: app/services/login_attempt_service.py

from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from app.db.models.user import AppData, LoginAttempt
from datetime import datetime, timedelta
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

class LoginAttemptService:
    
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_HOURS = 15
    
    @staticmethod
    def log_login_attempt(
        db: Session,
        customer_id: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        device_info: str,
        location: str,
        failure_reason: Optional[str] = None
    ) -> None:
        """
        Log a login attempt to the database
        """
        try:
            login_attempt = LoginAttempt(
                customer_id=customer_id,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
                device_info=device_info,
                location=location,
                failure_reason=failure_reason
            )
            db.add(login_attempt)
            db.commit()
            logger.info(f"Logged {'successful' if success else 'failed'} login attempt for customer {customer_id}")
        except Exception as e:
            logger.error(f"Failed to log login attempt: {str(e)}")
            db.rollback()

    @staticmethod
    def check_and_update_failed_attempts(db: Session, customer_id: str, success: bool) -> Tuple[bool, int]:
        """
        Check if user is locked and update failed attempt counter
        Returns: (is_blocked, attempts_remaining)
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                logger.error(f"No app data found for customer {customer_id}")
                return False, LoginAttemptService.MAX_FAILED_ATTEMPTS
            
            now = datetime.now()
            
            # Check if user is currently locked
            if app_data.login_blocked_until and app_data.login_blocked_until > now:
                remaining_time = app_data.login_blocked_until - now
                logger.info(f"Customer {customer_id} is locked for {remaining_time}")
                return True, 0
            
            if success:
                # Reset failed attempts on successful login
                if app_data.failed_login_attempts > 0:
                    app_data.failed_login_attempts = 0
                    app_data.login_blocked_until = None
                    app_data.last_failed_attempt_time = None
                    db.commit()
                    logger.info(f"Reset failed attempts for customer {customer_id}")
                return False, LoginAttemptService.MAX_FAILED_ATTEMPTS
            else:
                # Increment failed attempts
                app_data.failed_login_attempts += 1
                app_data.last_failed_attempt_time = now
                
                attempts_remaining = LoginAttemptService.MAX_FAILED_ATTEMPTS - app_data.failed_login_attempts
                
                if app_data.failed_login_attempts >= LoginAttemptService.MAX_FAILED_ATTEMPTS:
                    # Lock the account
                    app_data.login_blocked_until = now + timedelta(hours=LoginAttemptService.LOCKOUT_DURATION_HOURS)
                    attempts_remaining = 0
                    logger.warning(f"Customer {customer_id} locked after {app_data.failed_login_attempts} failed attempts")
                
                db.commit()
                return app_data.failed_login_attempts >= LoginAttemptService.MAX_FAILED_ATTEMPTS, attempts_remaining
                
        except Exception as e:
            logger.error(f"Error checking failed attempts for customer {customer_id}: {str(e)}")
            db.rollback()
            return False, LoginAttemptService.MAX_FAILED_ATTEMPTS

    @staticmethod
    def is_user_locked(db: Session, customer_id: str) -> Tuple[bool, Optional[datetime]]:
        """
        Check if user is currently locked
        Returns: (is_locked, unlock_time)
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return False, None
            
            now = datetime.now()
            if app_data.login_blocked_until and app_data.login_blocked_until > now:
                return True, app_data.login_blocked_until
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error checking if user is locked: {str(e)}")
            return False, None

    @staticmethod
    def get_failed_attempt_count(db: Session, customer_id: str) -> int:
        """
        Get current failed attempt count for a user
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return 0
            return app_data.failed_login_attempts
        except Exception as e:
            logger.error(f"Error getting failed attempt count: {str(e)}")
            return 0

    @staticmethod
    def reset_failed_attempts(db: Session, customer_id: str) -> bool:
        """
        Reset failed attempts (used when user chooses to restore app)
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return False
            
            app_data.failed_login_attempts = 0
            app_data.login_blocked_until = None
            app_data.last_failed_attempt_time = None
            db.commit()
            
            logger.info(f"Reset failed attempts for customer {customer_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error resetting failed attempts: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def get_lockout_info(db: Session, customer_id: str) -> dict:
        """
        Get detailed lockout information for frontend
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return {"is_locked": False}
            
            now = datetime.now()
            is_locked = app_data.login_blocked_until and app_data.login_blocked_until > now
            
            return {
                "is_locked": is_locked,
                "failed_attempts": app_data.failed_login_attempts,
                "attempts_remaining": max(0, LoginAttemptService.MAX_FAILED_ATTEMPTS - app_data.failed_login_attempts),
                "locked_until": app_data.login_blocked_until.isoformat() if app_data.login_blocked_until else None,
                "time_remaining_hours": (
                    (app_data.login_blocked_until - now).total_seconds() / 3600
                    if is_locked else 0
                )
            }
            
        except Exception as e:
            logger.error(f"Error getting lockout info: {str(e)}")
            return {"is_locked": False}