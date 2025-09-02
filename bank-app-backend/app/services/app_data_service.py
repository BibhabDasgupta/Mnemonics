# Enhanced app data service with better device tracking and dashboard support
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db.models.user import AppData
from app.services.sms_service import SMSService
from app.services.seedkey_attempt_service import SeedkeyAttemptService
import uuid
import logging
import json
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def revoke_app_access(
    db: Session, 
    customer_unique_id: uuid.UUID, 
    device_info: str = "Unknown Device",
    location: str = "Unknown Location",
    ip_address: str = "Unknown IP"
) -> AppData:
    """
    Finds a customer's AppData record by their unique ID and sets
    the app_access_revoked flag to True with enhanced notifications.
    """
    try:
        app_data_entry = db.query(AppData).filter(AppData.customer_id == str(customer_unique_id)).first()

        if not app_data_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer application data not found."
            )

        # Check if already revoked
        if app_data_entry.app_access_revoked:
            logger.warning(f"App access already revoked for customer: {customer_unique_id}")
            return app_data_entry

        # Set revocation flag
        app_data_entry.app_access_revoked = True
        app_data_entry.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(app_data_entry)
        
        logger.info(f"App access revoked successfully for customer: {customer_unique_id}")
        
        # Add device info to other_details for tracking
        try:
            SeedkeyAttemptService.add_device_info_to_other_details(
                db=db,
                customer_id=str(customer_unique_id),
                action_type="revocation",
                device_info=device_info,
                location=location,
                ip_address=ip_address,
                additional_info={
                    "revocation_time": datetime.now().isoformat(),
                    "revocation_reason": "user_requested"
                }
            )
            logger.info(f"Revocation device info tracked for customer: {customer_unique_id}")
        except Exception as device_error:
            logger.error(f"Failed to track revocation device info for customer {customer_unique_id}: {str(device_error)}")
            # Don't fail revocation due to tracking issues
        
        # Send SMS notification for revocation
        try:
            SMSService.send_revocation_notification(
                db=db,
                customer_id=str(customer_unique_id),
                device_info=device_info,
                location=location
            )
            logger.info(f"Revocation SMS sent successfully for customer {customer_unique_id}")
        except Exception as sms_error:
            logger.error(f"Failed to send revocation SMS for customer {customer_unique_id}: {str(sms_error)}")
            # Don't fail revocation due to SMS issues
        
        return app_data_entry
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during app access revocation for customer {customer_unique_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke app access: {str(e)}"
        )

def get_customer_device_history(db: Session, customer_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get device history from other_details for a customer"""
    try:
        app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
        
        if not app_data:
            return []
        
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
        
        # Filter and sort device history entries
        device_history = []
        for entry in other_details:
            if isinstance(entry, dict) and entry.get("action_type") in [
                "registration", "restoration", "login_success", "revocation", "transaction"
            ]:
                device_history.append(entry)
        
        # Sort by timestamp (most recent first) and limit results
        device_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return device_history[:limit]
        
    except Exception as e:
        logger.error(f"Error getting device history for customer {customer_id}: {str(e)}")
        return []

def get_registered_and_restored_devices(db: Session, customer_id: str) -> Dict[str, Any]:
    """Get only registered and restored devices for dashboard display"""
    try:
        app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
        
        if not app_data:
            return {
                "registered_devices": [], 
                "restored_devices": [], 
                "total_registrations": 0, 
                "total_restorations": 0,
                "latest_registration": None,
                "latest_restoration": None
            }
        
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
                        "device_info": entry.get("device_info", "Unknown Device"),
                        "timestamp": entry.get("timestamp"),
                        "location": entry.get("location", "Unknown Location"),
                        "ip_address": entry.get("ip_address", "Unknown IP"),
                        "device_id": entry.get("device_id"),
                        "user_agent": entry.get("user_agent"),
                        "registration_type": entry.get("registration_type", "standard")
                    })
                elif entry.get("action_type") == "restoration":
                    restored_devices.append({
                        "device_info": entry.get("device_info", "Unknown Device"),
                        "timestamp": entry.get("timestamp"),
                        "location": entry.get("location", "Unknown Location"),
                        "ip_address": entry.get("ip_address", "Unknown IP"),
                        "device_id": entry.get("device_id"),
                        "user_agent": entry.get("user_agent"),
                        "restoration_type": entry.get("restoration_type", "standard"),
                        "restoration_limits_activated": entry.get("restoration_limits_activated", False)
                    })
        
        # Sort by timestamp (most recent first)
        registered_devices.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        restored_devices.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # Get latest entries
        latest_registration = registered_devices[0] if registered_devices else None
        latest_restoration = restored_devices[0] if restored_devices else None
        
        return {
            "registered_devices": registered_devices,
            "restored_devices": restored_devices,
            "total_registrations": len(registered_devices),
            "total_restorations": len(restored_devices),
            "latest_registration": latest_registration,
            "latest_restoration": latest_restoration
        }
        
    except Exception as e:
        logger.error(f"Error getting registered/restored devices for customer {customer_id}: {str(e)}")
        return {
            "registered_devices": [], 
            "restored_devices": [], 
            "total_registrations": 0, 
            "total_restorations": 0,
            "latest_registration": None,
            "latest_restoration": None
        }

def get_customer_security_summary(db: Session, customer_id: str) -> Dict[str, Any]:
    """Get comprehensive security summary including device history and account status"""
    try:
        app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
        
        if not app_data:
            return {
                "customer_found": False,
                "error": "Customer not found"
            }
        
        # Get device information
        device_info = get_registered_and_restored_devices(db, customer_id)
        device_history = get_customer_device_history(db, customer_id, limit=10)
        
        # Count different types of activities
        registration_count = device_info["total_registrations"]
        restoration_count = device_info["total_restorations"]
        login_count = sum(1 for entry in device_history if entry.get("action_type") == "login_success")
        transaction_count = sum(1 for entry in device_history if entry.get("action_type") == "transaction")
        
        # Get latest activities
        latest_login = next((entry for entry in device_history if entry.get("action_type") == "login_success"), None)
        
        return {
            "customer_found": True,
            "customer_id": customer_id,
            "name": app_data.name,
            "app_access_revoked": app_data.app_access_revoked,
            "no_of_logged_in_devices": app_data.no_of_logged_in_devices,
            "last_logged_in_time": app_data.last_logged_in_time.isoformat() if app_data.last_logged_in_time else None,
            "created_at": app_data.created_at.isoformat() if app_data.created_at else None,
            "updated_at": app_data.updated_at.isoformat() if app_data.updated_at else None,
            "is_restoration_limited": app_data.is_restoration_limited,
            "restoration_limit_expires_at": app_data.restoration_limit_expires_at.isoformat() if app_data.restoration_limit_expires_at else None,
            
            # Device information
            "device_info": device_info,
            
            # Activity counts
            "activity_counts": {
                "total_registrations": registration_count,
                "total_restorations": restoration_count,
                "total_successful_logins": login_count,
                "total_transactions": transaction_count
            },
            
            # Latest activities
            "latest_activities": {
                "latest_login": latest_login,
                "latest_registration": device_info["latest_registration"],
                "latest_restoration": device_info["latest_restoration"]
            },
            
            # Recent device history
            "recent_device_history": device_history,
            
            # Security status
            "failed_login_attempts": app_data.failed_login_attempts,
            "seedkey_failed_attempts": getattr(app_data, 'seedkey_failed_attempts', 0),
            "seedkey_blocked_until": app_data.seedkey_blocked_until.isoformat() if getattr(app_data, 'seedkey_blocked_until', None) else None
        }
        
    except Exception as e:
        logger.error(f"Error getting security summary for customer {customer_id}: {str(e)}")
        return {
            "customer_found": False,
            "error": str(e)
        }