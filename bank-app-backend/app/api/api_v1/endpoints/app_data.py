# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session

# from app.db.base import get_db
# from app.schemas.app_data import AppAccessRevokeRequest
# from app.services import app_data_service

# router = APIRouter()

# @router.post("/appdata/revoke", status_code=200)
# def revoke_customer_access(
#     request: AppAccessRevokeRequest,
#     db: Session = Depends(get_db)
# ):
#     """
#     Endpoint to revoke a customer's access to the application.
#     """
#     try:
#         app_data_service.revoke_app_access(db, customer_unique_id=request.customer_unique_id)
#         return {"status": "success", "message": "Customer access has been revoked."}
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         # Catch any other unexpected errors
#         raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")




# Enhanced app data endpoints with dashboard device information - COMPLETE FILE
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.app_data import AppAccessRevokeRequest
from app.services import app_data_service
from app.services.seedkey_attempt_service import SeedkeyAttemptService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def get_device_info(request: Request) -> dict:
    """Extract device and location info from request"""
    user_agent = request.headers.get("user-agent", "Unknown")
    ip_address = request.client.host if request.client else "Unknown"
    
    # Simple device detection
    device_info = "Unknown Device"
    if "Chrome" in user_agent:
        device_info = "Chrome Browser"
    elif "Firefox" in user_agent:
        device_info = "Firefox Browser"
    elif "Safari" in user_agent:
        device_info = "Safari Browser"
    elif "Edge" in user_agent:
        device_info = "Edge Browser"
    
    return {
        "user_agent": user_agent,
        "ip_address": ip_address,
        "device_info": device_info,
        "location": "Location data from frontend"  # Will be updated from frontend
    }

@router.post("/appdata/revoke", status_code=200)
def revoke_customer_access(
    request: AppAccessRevokeRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Endpoint to revoke a customer's access to the application with enhanced notifications.
    """
    device_info = get_device_info(http_request)
    try:
        logger.info(f"Processing revocation request for customer: {request.customer_unique_id}")
        
        app_data_service.revoke_app_access(
            db, 
            customer_unique_id=request.customer_unique_id,
            device_info=device_info["device_info"],
            location=device_info["location"],
            ip_address=device_info["ip_address"]
        )
        
        return {
            "status": "success", 
            "message": "Customer access has been revoked successfully.",
            "notifications_sent": True,
            "device_tracked": True
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during revocation: {str(e)}")
        # Catch any other unexpected errors
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/appdata/{customer_id}/device-history")
def get_customer_device_history(
    customer_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get device history for a customer including registrations, restorations, logins, etc.
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        device_history = app_data_service.get_customer_device_history(
            db, 
            customer_id.strip(), 
            limit=min(limit, 50)  # Cap at 50 entries
        )
        
        return {
            "status": "success",
            "customer_id": customer_id,
            "device_history": device_history,
            "total_entries": len(device_history)
        }
        
    except Exception as e:
        logger.error(f"Error fetching device history for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device history: {str(e)}")

@router.get("/appdata/{customer_id}/registered-restored-devices")
def get_registered_restored_devices(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """
    FIXED: Get only registered and restored devices for dashboard display
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        device_info = app_data_service.get_registered_and_restored_devices(
            db, 
            customer_id.strip()
        )
        
        # Enhanced response format for frontend
        response_data = {
            "status": "success",
            "customer_id": customer_id,
            "registered_devices": [
                {
                    "device_info": device.get("device_info", "Unknown Device"),
                    "timestamp": device.get("timestamp", ""),
                    "location": device.get("location", "Unknown Location"),
                    "ip_address": device.get("ip_address", "Unknown IP"),
                    "device_type": device.get("registration_type", "standard"),
                    "user_agent": device.get("user_agent", ""),
                } for device in device_info["registered_devices"]
            ],
            "restored_devices": [
                {
                    "device_info": device.get("device_info", "Unknown Device"),
                    "timestamp": device.get("timestamp", ""),
                    "location": device.get("location", "Unknown Location"),
                    "ip_address": device.get("ip_address", "Unknown IP"),
                    "device_type": device.get("restoration_type", "standard"),
                    "restoration_limits_activated": device.get("restoration_limits_activated", False),
                    "user_agent": device.get("user_agent", ""),
                } for device in device_info["restored_devices"]
            ],
            "total_registrations": device_info["total_registrations"],
            "total_restorations": device_info["total_restorations"],
            "latest_registration": device_info["latest_registration"],
            "latest_restoration": device_info["latest_restoration"],
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error fetching registered/restored devices for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device information: {str(e)}")

@router.get("/appdata/{customer_id}/security-summary")
def get_customer_security_summary(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive security summary for a customer including device history, 
    account status, and activity counts.
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        security_summary = app_data_service.get_customer_security_summary(
            db, 
            customer_id.strip()
        )
        
        if not security_summary.get("customer_found"):
            raise HTTPException(
                status_code=404, 
                detail=security_summary.get("error", "Customer not found")
            )
        
        return {
            "status": "success",
            **security_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching security summary for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch security summary: {str(e)}")

@router.get("/appdata/{customer_id}/activity-stats")
def get_customer_activity_stats(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """
    Get activity statistics for dashboard display with detailed device information
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        security_summary = app_data_service.get_customer_security_summary(
            db, 
            customer_id.strip()
        )
        
        if not security_summary.get("customer_found"):
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Extract activity data for dashboard with device details
        activity_data = {
            "registrations": security_summary["activity_counts"]["total_registrations"],
            "restorations": security_summary["activity_counts"]["total_restorations"],
            "successful_logins": security_summary["activity_counts"]["total_successful_logins"],
            "transactions": security_summary["activity_counts"]["total_transactions"],
            
            # Latest activity timestamps
            "latest_login": security_summary["latest_activities"]["latest_login"],
            "latest_registration": security_summary["latest_activities"]["latest_registration"],
            "latest_restoration": security_summary["latest_activities"]["latest_restoration"],
            
            # Device information
            "registered_devices": security_summary["device_info"]["registered_devices"],
            "restored_devices": security_summary["device_info"]["restored_devices"],
            
            # Account status
            "is_restoration_limited": security_summary["is_restoration_limited"],
            "logged_in_devices": security_summary["no_of_logged_in_devices"],
            "app_access_revoked": security_summary["app_access_revoked"],
            
            # Security status
            "failed_login_attempts": security_summary["failed_login_attempts"],
            "seedkey_failed_attempts": security_summary["seedkey_failed_attempts"],
            "seedkey_blocked_until": security_summary.get("seedkey_blocked_until")
        }
        
        return {
            "status": "success",
            "customer_id": customer_id,
            **activity_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching activity stats for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity stats: {str(e)}")

@router.get("/appdata/{customer_id}/device-dashboard")
def get_device_dashboard(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """
    Specialized endpoint for dashboard showing registered and restored devices with counts
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        device_info = app_data_service.get_registered_and_restored_devices(db, customer_id.strip())
        
        # Format for dashboard display
        dashboard_data = {
            "device_summary": {
                "total_registered_devices": device_info["total_registrations"],
                "total_restored_devices": device_info["total_restorations"],
                "latest_registration_date": device_info["latest_registration"]["timestamp"] if device_info["latest_registration"] else None,
                "latest_restoration_date": device_info["latest_restoration"]["timestamp"] if device_info["latest_restoration"] else None
            },
            "registered_devices": [
                {
                    "device_name": device["device_info"],
                    "registration_date": device["timestamp"],
                    "location": device["location"],
                    "ip_address": device["ip_address"],
                    "device_type": device.get("registration_type", "standard")
                } for device in device_info["registered_devices"]
            ],
            "restored_devices": [
                {
                    "device_name": device["device_info"],
                    "restoration_date": device["timestamp"],
                    "location": device["location"],
                    "ip_address": device["ip_address"],
                    "device_type": device.get("restoration_type", "standard"),
                    "limits_applied": device.get("restoration_limits_activated", False)
                } for device in device_info["restored_devices"]
            ]
        }
        
        return {
            "status": "success",
            "customer_id": customer_id,
            **dashboard_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching device dashboard for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device dashboard: {str(e)}")

@router.get("/appdata/{customer_id}/seedkey-status")
def get_customer_seedkey_status(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """
    Get seedkey lockout status for dashboard display
    """
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id.strip())
        
        return {
            "status": "success",
            "customer_id": customer_id,
            "seedkey_status": lockout_info
        }
        
    except Exception as e:
        logger.error(f"Error fetching seedkey status for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch seedkey status: {str(e)}")