# --- File: app/api/api_v1/endpoints/login.py ---
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import EmailStr
from datetime import datetime, timedelta
import jwt
from app.db.base import get_db
from app.services import fido_seedkey_service
from app.services.sms_service import SMSService
from app.services.login_attempt_service import LoginAttemptService
from app.services.seedkey_attempt_service import SeedkeyAttemptService
from app.schemas.user import FidoLoginStartRequest, FidoLoginFinishRequest, SeedkeyVerificationRequest, LogoutRequest
from app.core.config import settings
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

@router.post("/login/fido-start")
def start_fido_login(request: FidoLoginStartRequest, http_request: Request, db: Session = Depends(get_db)):
    """Start FIDO2 login by generating authentication options and a challenge."""
    device_info = get_device_info(http_request)
    try:
        # Check if user is locked before proceeding
        is_locked, unlock_time = LoginAttemptService.is_user_locked(db, request.customer_id)
        if is_locked:
            lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
            
            # Send SMS notification about locked status
            try:
                SMSService.send_account_locked_notification(db, request.customer_id, device_info["device_info"])
            except Exception as sms_error:
                logger.error(f"Failed to send lockout SMS for customer {request.customer_id}: {str(sms_error)}")
            
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Account temporarily locked due to multiple failed login attempts",
                    "lockout_info": lockout_info
                }
            )
        
        return fido_seedkey_service.start_fido_login(db, request.customer_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"FIDO login start failed for customer {request.customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO login start failed: {str(e)}")

@router.post("/login/fido-finish")
def finish_fido_login(
    http_request: Request,
    request: FidoLoginFinishRequest,
    db: Session = Depends(get_db)
):
    """Finish FIDO2 login, verify the credential, and initiate seed key challenge."""
    device_info = get_device_info(http_request)
    
    try:
        # Check if user is locked
        is_locked, unlock_time = LoginAttemptService.is_user_locked(db, request.customer_id)
        if is_locked:
            # Log failed attempt
            LoginAttemptService.log_login_attempt(
                db, request.customer_id, False, device_info["ip_address"],
                device_info["user_agent"], device_info["device_info"],
                device_info["location"], "Account locked"
            )
            
            lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
            
            # Send SMS notification about locked status
            try:
                SMSService.send_account_locked_notification(db, request.customer_id, device_info["device_info"])
            except Exception as sms_error:
                logger.error(f"Failed to send lockout SMS: {str(sms_error)}")
            
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Account temporarily locked",
                    "lockout_info": lockout_info
                }
            )
        
        # Attempt FIDO login
        result = fido_seedkey_service.finish_fido_login(db, http_request, request.customer_id, request.credential)
        
        # If we get here, FIDO verification was successful but we need to check if symmetric key was received
        if result.get("status") != "fido_verified" or not result.get("symmetric_key"):
            # This means FIDO failed or symmetric key not received - treat as failed login attempt
            failure_reason = "FIDO verification failed or symmetric key not received"
            
            is_blocked, attempts_remaining = LoginAttemptService.check_and_update_failed_attempts(
                db, request.customer_id, False
            )
            
            LoginAttemptService.log_login_attempt(
                db, request.customer_id, False, device_info["ip_address"],
                device_info["user_agent"], device_info["device_info"],
                device_info["location"], failure_reason
            )
            
            # Send SMS notification for failed attempt
            try:
                SMSService.send_login_notification(
                    db, request.customer_id, False, device_info["device_info"],
                    device_info["location"], device_info["ip_address"],
                    attempts_remaining, failure_reason
                )
            except Exception as sms_error:
                logger.error(f"Failed to send login failure SMS: {str(sms_error)}")
            
            # If account is now blocked, send lock notification
            if is_blocked:
                try:
                    SMSService.send_account_locked_notification(
                        db, request.customer_id, device_info["device_info"]
                    )
                except Exception as sms_error:
                    logger.error(f"Failed to send account locked SMS: {str(sms_error)}")
                
                # Return lockout info
                lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
                raise HTTPException(
                    status_code=423,
                    detail={
                        "message": "Account locked after multiple failed attempts",
                        "lockout_info": lockout_info
                    }
                )
            
            raise HTTPException(status_code=400, detail={
                "message": failure_reason,
                "attempts_remaining": attempts_remaining
            })
        
        # FIDO verification successful, add device info tracking
        SeedkeyAttemptService.add_device_info_to_other_details(
            db=db,
            customer_id=request.customer_id,
            action_type="login_fido_success",
            device_info=device_info["device_info"],
            location=device_info["location"],
            ip_address=device_info["ip_address"],
            additional_info={
                "user_agent": device_info["user_agent"],
                "login_step": "fido_completed"
            }
        )
        
        return result
        
    except HTTPException as e:
        # Log failed attempt for FIDO verification failures
        failure_reason = "FIDO verification failed"
        if hasattr(e, 'detail'):
            if isinstance(e.detail, dict) and 'message' in e.detail:
                failure_reason = e.detail['message']
            elif isinstance(e.detail, str):
                failure_reason = e.detail
        
        is_blocked, attempts_remaining = LoginAttemptService.check_and_update_failed_attempts(
            db, request.customer_id, False
        )
        
        LoginAttemptService.log_login_attempt(
            db, request.customer_id, False, device_info["ip_address"],
            device_info["user_agent"], device_info["device_info"],
            device_info["location"], failure_reason
        )
        
        # Send SMS notification for failed attempt
        try:
            SMSService.send_login_notification(
                db, request.customer_id, False, device_info["device_info"],
                device_info["location"], device_info["ip_address"],
                attempts_remaining, failure_reason
            )
        except Exception as sms_error:
            logger.error(f"Failed to send login failure SMS: {str(sms_error)}")
        
        # If account is now blocked, send lock notification
        if is_blocked:
            try:
                SMSService.send_account_locked_notification(
                    db, request.customer_id, device_info["device_info"]
                )
            except Exception as sms_error:
                logger.error(f"Failed to send account locked SMS: {str(sms_error)}")
            
            # Return lockout info
            lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Account locked after multiple failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        raise e
    except Exception as e:
        # Log failed attempt for unexpected errors
        is_blocked, attempts_remaining = LoginAttemptService.check_and_update_failed_attempts(
            db, request.customer_id, False
        )
        
        LoginAttemptService.log_login_attempt(
            db, request.customer_id, False, device_info["ip_address"],
            device_info["user_agent"], device_info["device_info"],
            device_info["location"], "System error"
        )
        
        # Send SMS notification
        try:
            SMSService.send_login_notification(
                db, request.customer_id, False, device_info["device_info"],
                device_info["location"], device_info["ip_address"],
                attempts_remaining, "System error"
            )
        except Exception as sms_error:
            logger.error(f"Failed to send login failure SMS: {str(sms_error)}")
        
        if is_blocked:
            try:
                SMSService.send_account_locked_notification(
                    db, request.customer_id, device_info["device_info"]
                )
            except Exception as sms_error:
                logger.error(f"Failed to send account locked SMS: {str(sms_error)}")
        
        logger.error(f"FIDO login finish failed for customer {request.customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO login finish failed: {str(e)}")

@router.post("/login/seedkey-verify")
def verify_seedkey(
    request: SeedkeyVerificationRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """Verify the seed key signature, issue a JWT, and update login metadata."""
    device_info = get_device_info(http_request)
    
    try:
        # Check if user is locked
        is_locked, unlock_time = LoginAttemptService.is_user_locked(db, request.customer_id)
        if is_locked:
            lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
            
            # Send SMS notification about locked status
            try:
                SMSService.send_account_locked_notification(db, request.customer_id, device_info["device_info"])
            except Exception as sms_error:
                logger.error(f"Failed to send lockout SMS: {str(sms_error)}")
            
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Account temporarily locked",
                    "lockout_info": lockout_info
                }
            )
        
        # Verify seed key signature
        result = fido_seedkey_service.verify_seedkey_signature(db, request.customer_id, request.challenge, request.public_key)
        
        # Generate JWT
        payload = {
            "sub": request.customer_id,
            "exp": datetime.utcnow() + timedelta(minutes=10),
            "iat": datetime.utcnow()
        }
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

        # Update no_of_logged_in_devices
        customer = fido_seedkey_service.get_customer_by_id(db, request.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        fido_seedkey_service.update_login_metadata(db, request.customer_id)
        
        # Log successful login attempt
        LoginAttemptService.check_and_update_failed_attempts(db, request.customer_id, True)
        LoginAttemptService.log_login_attempt(
            db, request.customer_id, True, device_info["ip_address"],
            device_info["user_agent"], device_info["device_info"],
            device_info["location"]
        )
        
        # Add device info for successful login
        SeedkeyAttemptService.add_device_info_to_other_details(
            db=db,
            customer_id=request.customer_id,
            action_type="login_success",
            device_info=device_info["device_info"],
            location=device_info["location"],
            ip_address=device_info["ip_address"],
            additional_info={
                "user_agent": device_info["user_agent"],
                "login_step": "completed",
                "jwt_issued": True
            }
        )
        
        # Send SMS notification for successful login
        try:
            SMSService.send_login_notification(
                db, request.customer_id, True, device_info["device_info"],
                device_info["location"], device_info["ip_address"]
            )
        except Exception as sms_error:
            logger.error(f"Failed to send login success SMS: {str(sms_error)}")
            # Don't fail login due to SMS issues

        return {
            "status": "login_success",
            "token": token,
            "customer_id": request.customer_id
        }
    except HTTPException as e:
        # Log failed attempt for seed key verification failures
        failure_reason = "Seed key verification failed"
        if hasattr(e, 'detail'):
            if isinstance(e.detail, dict) and 'message' in e.detail:
                failure_reason = e.detail['message']
            elif isinstance(e.detail, str):
                failure_reason = e.detail
        
        is_blocked, attempts_remaining = LoginAttemptService.check_and_update_failed_attempts(
            db, request.customer_id, False
        )
        
        LoginAttemptService.log_login_attempt(
            db, request.customer_id, False, device_info["ip_address"],
            device_info["user_agent"], device_info["device_info"],
            device_info["location"], failure_reason
        )
        
        # Send SMS notification
        try:
            SMSService.send_login_notification(
                db, request.customer_id, False, device_info["device_info"],
                device_info["location"], device_info["ip_address"],
                attempts_remaining, failure_reason
            )
        except Exception as sms_error:
            logger.error(f"Failed to send login failure SMS: {str(sms_error)}")
        
        # Check if account is now blocked
        if is_blocked:
            try:
                SMSService.send_account_locked_notification(
                    db, request.customer_id, device_info["device_info"]
                )
            except Exception as sms_error:
                logger.error(f"Failed to send account locked SMS: {str(sms_error)}")
            
            lockout_info = LoginAttemptService.get_lockout_info(db, request.customer_id)
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Account locked after multiple failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        raise e
    except Exception as e:
        # Log failed attempt for unexpected errors
        is_blocked, attempts_remaining = LoginAttemptService.check_and_update_failed_attempts(
            db, request.customer_id, False
        )
        
        LoginAttemptService.log_login_attempt(
            db, request.customer_id, False, device_info["ip_address"],
            device_info["user_agent"], device_info["device_info"],
            device_info["location"], "System error"
        )
        
        # Send SMS notification
        try:
            SMSService.send_login_notification(
                db, request.customer_id, False, device_info["device_info"],
                device_info["location"], device_info["ip_address"],
                attempts_remaining, "System error"
            )
        except Exception as sms_error:
            logger.error(f"Failed to send login failure SMS: {str(sms_error)}")
        
        if is_blocked:
            try:
                SMSService.send_account_locked_notification(
                    db, request.customer_id, device_info["device_info"]
                )
            except Exception as sms_error:
                logger.error(f"Failed to send account locked SMS: {str(sms_error)}")
        
        logger.error(f"Seed key verification failed for customer {request.customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Seed key verification failed: {str(e)}")

# New endpoint to check lockout status
@router.get("/login/status/{customer_id}")
def get_login_status(customer_id: str, db: Session = Depends(get_db)):
    """Get current login status and lockout information"""
    try:
        lockout_info = LoginAttemptService.get_lockout_info(db, customer_id)
        return lockout_info
    except Exception as e:
        logger.error(f"Failed to get login status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get login status: {str(e)}")

# New endpoint to reset login attempts (for app restoration)
@router.post("/login/reset-attempts")
def reset_login_attempts(customer_id: str, http_request: Request, db: Session = Depends(get_db)):
    """Reset failed login attempts (called when user chooses to restore app)"""
    device_info = get_device_info(http_request)
    try:
        success = LoginAttemptService.reset_failed_attempts(db, customer_id)
        if success:
            # Add device info for reset action
            SeedkeyAttemptService.add_device_info_to_other_details(
                db=db,
                customer_id=customer_id,
                action_type="login_attempts_reset",
                device_info=device_info["device_info"],
                location=device_info["location"],
                ip_address=device_info["ip_address"],
                additional_info={
                    "user_agent": device_info["user_agent"],
                    "reset_reason": "app_restoration_requested"
                }
            )
            
            # Send SMS notification for reset
            try:
                SMSService.send_anomaly_detection_notification(
                    db=db,
                    customer_id=customer_id,
                    anomaly_type="Login Attempts Reset",
                    details="Failed login attempts have been reset as part of app restoration process",
                    device_info=device_info["device_info"],
                    location=device_info["location"]
                )
            except Exception as sms_error:
                logger.error(f"Failed to send reset SMS: {str(sms_error)}")
            
            return {"status": "success", "message": "Failed attempts reset successfully"}
        else:
            raise HTTPException(status_code=404, detail="Customer not found")
    except Exception as e:
        logger.error(f"Failed to reset attempts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset attempts: {str(e)}")

@router.post("/logout")
def logout_user(
    request: LogoutRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """Handle user logout and decrease logged in devices count"""
    device_info = get_device_info(http_request)
    try:
        # Decrease the logged in devices count
        success = fido_seedkey_service.decrease_login_metadata(db, request.customer_id)
        
        # Add device info for logout
        SeedkeyAttemptService.add_device_info_to_other_details(
            db=db,
            customer_id=request.customer_id,
            action_type="logout",
            device_info=device_info["device_info"],
            location=device_info["location"],
            ip_address=device_info["ip_address"],
            additional_info={
                "user_agent": device_info["user_agent"],
                "logout_time": datetime.now().isoformat()
            }
        )
        
        if success:
            logger.info(f"Successfully logged out customer {request.customer_id}")
            return {
                "status": "success",
                "message": "Logged out successfully",
                "customer_id": request.customer_id
            }
        else:
            logger.warning(f"Customer {request.customer_id} not found during logout")
            return {
                "status": "success", 
                "message": "Logged out successfully",
                "customer_id": request.customer_id
            }
    except Exception as e:
        logger.error(f"Error during logout for customer {request.customer_id}: {str(e)}")
        # Still return success to avoid blocking logout
        return {
            "status": "success",
            "message": "Logged out successfully",
            "customer_id": request.customer_id
        }