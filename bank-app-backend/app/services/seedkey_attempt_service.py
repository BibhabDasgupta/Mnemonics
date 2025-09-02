# Enhanced Seedkey attempt tracking service with FIXED datetime handling
from sqlalchemy.orm import Session
from app.db.models.user import AppData, SeedkeyAttempt
from datetime import datetime, timedelta, timezone
import logging
from typing import Tuple, Optional, Dict, Any, List
import json

logger = logging.getLogger(__name__)

class SeedkeyAttemptService:
    
    MAX_FAILED_ATTEMPTS = 3
    LOCKOUT_DURATION_HOURS = 24
    
    @staticmethod
    def log_seedkey_attempt(
        db: Session,
        customer_id: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        device_info: str,
        location: str,
        failure_reason: Optional[str] = None
    ) -> None:
        """Log a seedkey verification attempt to the database"""
        try:
            seedkey_attempt = SeedkeyAttempt(
                customer_id=customer_id,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
                device_info=device_info,
                location=location,
                failure_reason=failure_reason
            )
            db.add(seedkey_attempt)
            db.commit()
            logger.info(f"Logged {'successful' if success else 'failed'} seedkey attempt for customer {customer_id}")
        except Exception as e:
            logger.error(f"Failed to log seedkey attempt: {str(e)}")
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
                return False, SeedkeyAttemptService.MAX_FAILED_ATTEMPTS
            
            # FIXED: Use timezone-aware datetime consistently
            now = datetime.now(timezone.utc)
            
            # Check if user is currently locked
            if app_data.seedkey_blocked_until:
                # Convert to UTC if naive datetime
                blocked_until = app_data.seedkey_blocked_until
                if blocked_until.tzinfo is None:
                    blocked_until = blocked_until.replace(tzinfo=timezone.utc)
                
                if blocked_until > now:
                    remaining_time = blocked_until - now
                    logger.info(f"Customer {customer_id} seedkey locked for {remaining_time}")
                    return True, 0
            
            if success:
                # Reset failed attempts on successful verification
                if app_data.seedkey_failed_attempts > 0:
                    app_data.seedkey_failed_attempts = 0
                    app_data.seedkey_blocked_until = None
                    app_data.last_seedkey_attempt_time = now
                    db.commit()
                    logger.info(f"Reset seedkey failed attempts for customer {customer_id}")
                return False, SeedkeyAttemptService.MAX_FAILED_ATTEMPTS
            else:
                # Increment failed attempts
                app_data.seedkey_failed_attempts += 1
                app_data.last_seedkey_attempt_time = now
                
                attempts_remaining = SeedkeyAttemptService.MAX_FAILED_ATTEMPTS - app_data.seedkey_failed_attempts
                
                if app_data.seedkey_failed_attempts >= SeedkeyAttemptService.MAX_FAILED_ATTEMPTS:
                    # Lock the account for 24 hours
                    app_data.seedkey_blocked_until = now + timedelta(hours=SeedkeyAttemptService.LOCKOUT_DURATION_HOURS)
                    attempts_remaining = 0
                    logger.warning(f"Customer {customer_id} seedkey locked for 24 hours after {app_data.seedkey_failed_attempts} failed attempts")
                
                db.commit()
                return app_data.seedkey_failed_attempts >= SeedkeyAttemptService.MAX_FAILED_ATTEMPTS, attempts_remaining
                
        except Exception as e:
            logger.error(f"Error checking seedkey failed attempts for customer {customer_id}: {str(e)}")
            db.rollback()
            return False, SeedkeyAttemptService.MAX_FAILED_ATTEMPTS

    @staticmethod
    def is_seedkey_locked(db: Session, customer_id: str) -> Tuple[bool, Optional[datetime]]:
        """
        Check if user's seedkey verification is currently locked
        Returns: (is_locked, unlock_time)
        """
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return False, None
            
            # FIXED: Use timezone-aware datetime
            now = datetime.now(timezone.utc)
            
            if app_data.seedkey_blocked_until:
                blocked_until = app_data.seedkey_blocked_until
                if blocked_until.tzinfo is None:
                    blocked_until = blocked_until.replace(tzinfo=timezone.utc)
                
                if blocked_until > now:
                    return True, blocked_until
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error checking if seedkey is locked: {str(e)}")
            return False, None

    @staticmethod
    def get_seedkey_failed_attempt_count(db: Session, customer_id: str) -> int:
        """Get current failed seedkey attempt count for a user"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return 0
            return app_data.seedkey_failed_attempts
        except Exception as e:
            logger.error(f"Error getting seedkey failed attempt count: {str(e)}")
            return 0

    @staticmethod
    def reset_seedkey_failed_attempts(db: Session, customer_id: str) -> bool:
        """Reset seedkey failed attempts (admin function)"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return False
            
            app_data.seedkey_failed_attempts = 0
            app_data.seedkey_blocked_until = None
            app_data.last_seedkey_attempt_time = None
            db.commit()
            
            logger.info(f"Reset seedkey failed attempts for customer {customer_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error resetting seedkey failed attempts: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def get_seedkey_lockout_info(db: Session, customer_id: str) -> Dict[str, Any]:
        """Get detailed seedkey lockout information for frontend"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return {
                    "is_locked": False,
                    "failed_attempts": 0,
                    "attempts_remaining": SeedkeyAttemptService.MAX_FAILED_ATTEMPTS,
                    "locked_until": None,
                    "time_remaining_hours": 0,
                    "lockout_duration_hours": SeedkeyAttemptService.LOCKOUT_DURATION_HOURS
                }
            
            # FIXED: Use timezone-aware datetime consistently
            now = datetime.now(timezone.utc)
            is_locked = False
            time_remaining_hours = 0
            
            if app_data.seedkey_blocked_until:
                blocked_until = app_data.seedkey_blocked_until
                if blocked_until.tzinfo is None:
                    blocked_until = blocked_until.replace(tzinfo=timezone.utc)
                
                is_locked = blocked_until > now
                if is_locked:
                    time_remaining_hours = (blocked_until - now).total_seconds() / 3600
            
            return {
                "is_locked": is_locked,
                "failed_attempts": app_data.seedkey_failed_attempts or 0,
                "attempts_remaining": max(0, SeedkeyAttemptService.MAX_FAILED_ATTEMPTS - (app_data.seedkey_failed_attempts or 0)),
                "locked_until": app_data.seedkey_blocked_until.isoformat() if app_data.seedkey_blocked_until else None,
                "time_remaining_hours": max(0, time_remaining_hours),
                "lockout_duration_hours": SeedkeyAttemptService.LOCKOUT_DURATION_HOURS
            }
            
        except Exception as e:
            logger.error(f"Error getting seedkey lockout info for customer {customer_id}: {str(e)}")
            logger.exception("Full traceback:")
            return {
                "is_locked": False,
                "failed_attempts": 0,
                "attempts_remaining": SeedkeyAttemptService.MAX_FAILED_ATTEMPTS,
                "locked_until": None,
                "time_remaining_hours": 0,
                "lockout_duration_hours": SeedkeyAttemptService.LOCKOUT_DURATION_HOURS
            }

    @staticmethod
    def add_device_info_to_other_details(
        db: Session,
        customer_id: str,
        action_type: str,  # 'registration', 'restoration', 'login', etc.
        device_info: str,
        location: str,
        ip_address: str,
        additional_info: Optional[Dict] = None
    ) -> bool:
        """Add device information to app_data.other_details with proper handling"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                logger.error(f"No app data found for customer {customer_id}")
                return False
            
            # Handle different types of other_details properly
            current_details = []
            
            if app_data.other_details is None:
                current_details = []
            elif isinstance(app_data.other_details, list):
                current_details = app_data.other_details
            elif isinstance(app_data.other_details, str):
                try:
                    # Try to parse as JSON string
                    current_details = json.loads(app_data.other_details)
                    if not isinstance(current_details, list):
                        current_details = []
                except (json.JSONDecodeError, TypeError):
                    logger.warning(f"Could not parse other_details as JSON, starting fresh for customer {customer_id}")
                    current_details = []
            else:
                logger.warning(f"Unexpected other_details type {type(app_data.other_details)}, starting fresh for customer {customer_id}")
                current_details = []
            
            # Create device info entry (only for registration/restoration)
            if action_type in ["registration", "restoration"]:
                device_entry = {
                    "action_type": action_type,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "device_info": device_info,
                    "location": location,
                    "ip_address": ip_address,
                    "device_id": f"{device_info}_{ip_address}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                }
                
                if additional_info:
                    device_entry.update(additional_info)
                
                # Add to the list (keep only last 50 entries to prevent bloat)
                current_details.append(device_entry)
                if len(current_details) > 50:
                    current_details = current_details[-50:]
                
                app_data.other_details = current_details
                app_data.updated_at = datetime.now(timezone.utc)
                db.commit()
                
                logger.info(f"Added {action_type} device info for customer {customer_id}")
                return True
            else:
                # For other action types, just log without storing
                logger.info(f"Logged {action_type} activity for customer {customer_id} (not stored in other_details)")
                return True
                
        except Exception as e:
            logger.error(f"Error adding device info to other_details: {str(e)}")
            logger.exception("Full traceback:")
            db.rollback()
            return False

    @staticmethod
    def get_registered_and_restored_devices(db: Session, customer_id: str) -> Dict[str, Any]:
        """Get only registered and restored devices for dashboard"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                return {"registered_devices": [], "restored_devices": [], "total_registrations": 0, "total_restorations": 0}
            
            # Handle other_details properly
            other_details = []
            if app_data.other_details is None:
                other_details = []
            elif isinstance(app_data.other_details, list):
                other_details = app_data.other_details
            elif isinstance(app_data.other_details, str):
                try:
                    other_details = json.loads(app_data.other_details)
                    if not isinstance(other_details, list):
                        other_details = []
                except (json.JSONDecodeError, TypeError):
                    other_details = []
            
            # Filter and categorize devices
            registered_devices = []
            restored_devices = []
            
            for entry in other_details:
                if isinstance(entry, dict):
                    if entry.get("action_type") == "registration":
                        registered_devices.append({
                            "device_info": entry.get("device_info"),
                            "timestamp": entry.get("timestamp"),
                            "location": entry.get("location"),
                            "ip_address": entry.get("ip_address"),
                            "device_id": entry.get("device_id")
                        })
                    elif entry.get("action_type") == "restoration":
                        restored_devices.append({
                            "device_info": entry.get("device_info"),
                            "timestamp": entry.get("timestamp"),
                            "location": entry.get("location"),
                            "ip_address": entry.get("ip_address"),
                            "device_id": entry.get("device_id"),
                            "restoration_limits_activated": entry.get("restoration_limits_activated", False)
                        })
            
            # Sort by timestamp (most recent first)
            registered_devices.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            restored_devices.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            
            return {
                "registered_devices": registered_devices,
                "restored_devices": restored_devices,
                "total_registrations": len(registered_devices),
                "total_restorations": len(restored_devices)
            }
            
        except Exception as e:
            logger.error(f"Error getting registered/restored devices for customer {customer_id}: {str(e)}")
            return {"registered_devices": [], "restored_devices": [], "total_registrations": 0, "total_restorations": 0}