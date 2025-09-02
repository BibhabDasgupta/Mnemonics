# --- File: app/api/api_v1/endpoints/restore.py ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.user import PhoneVerificationRequest, CustomerCreate, FidoLoginStartRequest, MnemonicAttemptRequest
from app.services.fido_seedkey_service import start_fido_registration, register_fido_seedkey
from app.services.otp_service import decrypt_phone_number, check_phone_number, decrypt_data
from app.services.restoration_limit_service import RestorationLimitService
from app.services.sms_service import SMSService
from app.services.seedkey_attempt_service import SeedkeyAttemptService
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from app.services import signature_service
from app.db.models.user import AppData, Seedkey, Passkey, SeedkeyAttempt
from sqlalchemy.sql import text
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)



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

def post_restoration_setup(db: Session, customer_id: str) -> dict:
    """Setup post-restoration security measures"""
    try:
        # Activate restoration limits
        limits_activated = RestorationLimitService.activate_restoration_limits(
            db=db,
            customer_id=customer_id
        )
        
        restoration_info = RestorationLimitService.get_restoration_info(db, customer_id)
        
        return {
            "limits_activated": limits_activated,
            "restoration_info": restoration_info,
            "security_message": "Post-restoration security limits activated: ₹5,000 transaction limit for 35 hours"
        }
        
    except Exception as e:
        logger.exception(f"Error setting up post-restoration limits: {e}")
        return {
            "limits_activated": False,
            "error": "Failed to activate restoration limits"
        }

@router.post("/restore/check")
async def check_restoration_phone(request: PhoneVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        # Decrypt the phone number
        phone_number = decrypt_phone_number(request.encrypted_phone_number)
        
        # Check if phone number exists in accounts table
        customer = check_phone_number(db, phone_number)
        
        if customer["status"] == "fresh":
            raise HTTPException(
                status_code=404,
                detail="Phone number not registered. Please register first."
            )
        
        if customer["status"] == "new":
            raise HTTPException(
                status_code=404,
                detail="Phone number not registered in app. Please complete registration."
            )
        
        # Check app_data for revocation status
        app_data_query = text("""
            SELECT app_access_revoked
            FROM app_data
            WHERE phone_number = :phone_number
        """)
        app_data = db.execute(app_data_query, {"phone_number": phone_number}).fetchone()
        
        if not app_data:
            raise HTTPException(
                status_code=404,
                detail="App data not found for this phone number."
            )
        
        if app_data.app_access_revoked:
            raise HTTPException(
                status_code=403,
                detail="Account access revoked. Please visit a branch to re-register."
            )
        
        return {
            "status": "registered",
            "phone_number": phone_number,
            "customer_id": customer["customer_id"],
            "message": "Phone number is registered and eligible for restoration."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking phone number for restoration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/restore/complete")
async def complete_restoration(customer_data: CustomerCreate, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        # Decrypt the incoming encrypted fields
        try:
            customer_id = decrypt_data(customer_data.encrypted_customer_id)
            phone_number = decrypt_data(customer_data.encrypted_phone_number)
            name = decrypt_data(customer_data.encrypted_name)
            email = decrypt_data(customer_data.encrypted_email)
            aadhaar_number = decrypt_data(customer_data.encrypted_aadhaar_number)
            date_of_birth = decrypt_data(customer_data.encrypted_date_of_birth)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # Validate date format
        try:
            datetime.strptime(date_of_birth, '%Y-%m-%d')
        except ValueError as ve:
            raise HTTPException(status_code=422, detail="Invalid date format for date_of_birth, expected YYYY-MM-DD")
        
        # Verify details against app_data table
        query = text("""
            SELECT name, email, aadhaar_number, date_of_birth
            FROM app_data
            WHERE customer_id = :customer_id AND phone_number = :phone_number
        """)
        result = db.execute(query, {
            "customer_id": customer_id,
            "phone_number": phone_number
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="App data not found for this customer")
        
        db_name = result.name.strip() if result.name else ""
        db_email = result.email.strip().lower() if result.email else ""
        db_aadhaar = result.aadhaar_number.strip() if result.aadhaar_number else ""
        db_dob = str(result.date_of_birth) if result.date_of_birth else ""
        
        input_name = name.strip() if name else ""
        input_email = email.strip().lower() if email else ""
        input_aadhaar = aadhaar_number.strip() if aadhaar_number else ""
        input_dob = date_of_birth.strip() if date_of_birth else ""
        
        # Check if details match
        if not (
            db_name == input_name and
            db_email == input_email and
            db_aadhaar == input_aadhaar and
            db_dob == input_dob
        ):
            raise HTTPException(status_code=422, detail="Details do not match app data records")
        
        return {
            "status": "Restoration details verified successfully",
            "customer_id": customer_id,
            "phone_number": phone_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error completing restoration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Restoration failed: {str(e)}")

@router.post("/restore/fido-start")
async def fido_start_restoration(data: FidoLoginStartRequest, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        customer_id = decrypt_data(data.customer_id)
        return start_fido_registration(db, customer_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FIDO restoration start failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO restoration start failed: {str(e)}")

@router.post("/restore/fido-seedkey")
async def restore_fido_seedkey(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    ip_address = device_info["ip_address"]
    user_agent = device_info["user_agent"]
    location = device_info["location"]
    device_str = device_info["device_info"]
    
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data or 'fidoData' not in data or 'seedData' not in data:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        try:
            phone_number = decrypt_data(data['phoneNumber'])
            customer_id = decrypt_data(data['customerId'])
            fido_data = {
                "credentialId": decrypt_data(data['fidoData']['credentialId']),
                "publicKey": decrypt_data(data['fidoData']['publicKey']),
                "symmetricKey": decrypt_data(data['fidoData']['symmetricKey']),
                "clientDataJSON": data['fidoData']['clientDataJSON'],
                "attestationObject": data['fidoData']['attestationObject'],
            }
            seed_data = {
                "userId": decrypt_data(data['seedData']['userId']),
                "publicKey": decrypt_data(data['seedData']['publicKey']),
            }
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # FIXED: Check lockout status FIRST before any processing
        is_locked, unlock_time = SeedkeyAttemptService.is_seedkey_locked(db, customer_id)
        if is_locked:
            lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
            logger.warning(f"Seedkey restoration attempted while locked for customer {customer_id}")
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Seedkey restoration is locked due to multiple failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        # Verify seed key against database
        seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id, Seedkey.user_id == seed_data['userId']).first()
        
        verification_success = False
        failure_reason = None
        
        if not seedkey:
            failure_reason = "Seed key not found for this customer"
        elif seedkey.public_key.lower() != seed_data['publicKey'].lower():
            failure_reason = "Seed key public key does not match stored key"
        else:
            verification_success = True
        
        # FIXED: Log attempt and handle response properly
        SeedkeyAttemptService.log_seedkey_attempt(
            db=db,
            customer_id=customer_id,
            success=verification_success,
            ip_address=ip_address,
            user_agent=user_agent,
            device_info=device_str,
            location=location,
            failure_reason=failure_reason
        )
        
        if not verification_success:
            # FIXED: Get proper attempt tracking response
            is_blocked, attempts_remaining = SeedkeyAttemptService.check_and_update_failed_attempts(db, customer_id, False)
            
            logger.warning(f"Seedkey restoration failed for customer {customer_id}: {failure_reason}. Attempts remaining: {attempts_remaining}")
            
            # Send SMS notification
            try:
                SMSService.send_seedkey_attempt_notification(
                    db=db,
                    customer_id=customer_id,
                    attempts_remaining=attempts_remaining,
                    device_info=device_str,
                    is_final_attempt=is_blocked
                )
                logger.info(f"SMS notification sent for failed seedkey attempt. Customer: {customer_id}")
            except Exception as sms_error:
                logger.error(f"Failed to send seedkey attempt SMS: {str(sms_error)}")
            
            if is_blocked:
                lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
                raise HTTPException(
                    status_code=423,
                    detail={
                        "message": "Seedkey restoration locked for 24 hours after 3 failed attempts",
                        "lockout_info": lockout_info
                    }
                )
            
            raise HTTPException(
                status_code=422, 
                detail={
                    "message": failure_reason,
                    "attempts_remaining": attempts_remaining,
                    "failed_attempts": 3 - attempts_remaining
                }
            )
        
        # SUCCESS: Reset failed attempts and continue with restoration
        SeedkeyAttemptService.check_and_update_failed_attempts(db, customer_id, True)
        logger.info(f"Seedkey restoration verification successful for customer {customer_id}")
        
        try:
            credential_id_bytes = base64url_to_bytes(fido_data['credentialId'])
            public_key_bytes = base64url_to_bytes(fido_data['publicKey'])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64url format for FIDO data: {str(e)}")

        passkey = Passkey(
            customer_id=customer_id,
            credential_id=credential_id_bytes,
            public_key=public_key_bytes,
            symmetric_key=fido_data['symmetricKey'],
            sign_count=0,
            created_at=datetime.utcnow(),
        )
        db.add(passkey)
        db.commit()
        
        logger.info(f"Account restoration completed successfully for customer: {customer_id}")
        logger.info(f"Activating post-restoration security limits for customer: {customer_id}")
        
        restoration_setup = post_restoration_setup(db, customer_id)
        
        if restoration_setup["limits_activated"]:
            logger.info(f"Post-restoration limits activated successfully: {customer_id}")
        else:
            logger.warning(f"Failed to activate post-restoration limits: {customer_id}")
        
        SeedkeyAttemptService.add_device_info_to_other_details(
            db=db,
            customer_id=customer_id,
            action_type="restoration",
            device_info=device_str,
            location=location,
            ip_address=ip_address,
            additional_info={
                "user_agent": user_agent,
                "restoration_type": "fido_seedkey",
                "restoration_limits_activated": restoration_setup["limits_activated"]
            }
        )
        
        try:
            SMSService.send_restoration_notification(
                db=db,
                customer_id=customer_id,
                device_info=device_str,
                location=location,
                ip_address=ip_address,
                restoration_limits_info=restoration_setup.get("restoration_info", {})
            )
            logger.info(f"Restoration SMS sent successfully for customer {customer_id}")
        except Exception as sms_error:
            logger.error(f"Failed to send restoration SMS for customer {customer_id}: {str(sms_error)}")
        
        return {
            "status": "FIDO2 and seed key restored successfully",
            "customer_id": customer_id,
            "restoration_completed": True,
            "restoration_limits": {
                "activated": restoration_setup["limits_activated"],
                "limit_amount": 5000,
                "duration_hours": 35,
                "message": "For security, transactions are limited to ₹5,000 for the next 35 hours after account restoration."
            },
            "restoration_info": restoration_setup.get("restoration_info"),
            "security_notice": restoration_setup.get("security_message", "Post-restoration security measures applied")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"FIDO2 and seed key restoration failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO2 and seed key restoration failed: {str(e)}")
    

@router.post("/restore/check-signature")
async def check_signature(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data:
            raise HTTPException(status_code=400, detail="Missing phoneNumber or customerId")
        
        try:
            phone_number = decrypt_data(data['phoneNumber'])
            customer_id = decrypt_data(data['customerId'])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        query = text("""
            SELECT other_details
            FROM app_data
            WHERE customer_id = :customer_id AND phone_number = :phone_number
        """)
        result = db.execute(query, {
            "customer_id": customer_id,
            "phone_number": phone_number
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="App data not found for this customer")
        
        other_details = result.other_details
        signature_exists = False
        
        if other_details:
            for item in other_details:
                if 'signature' in item:
                    signature_exists = True
                    break
        
        return {
            "status": "success",
            "signature_exists": signature_exists
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking signature: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking signature: {str(e)}")




@router.post("/restore/signature")
async def verify_signature(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data or 'signature' not in data:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        try:
            phone_number = decrypt_data(data['phoneNumber'])
            customer_id = decrypt_data(data['customerId'])
            signature_data = data['signature']  # Signature is sent unencrypted
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # Preprocess and extract features
        img = signature_service.preprocess_signature(signature_data)
        new_features = signature_service.extract_all_features(img)
        
        # Fetch stored signature features
        query = text("""
            SELECT other_details
            FROM app_data
            WHERE customer_id = :customer_id AND phone_number = :phone_number
        """)
        result = db.execute(query, {
            "customer_id": customer_id,
            "phone_number": phone_number
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="App data not found")
        
        stored_features = None
        for item in result.other_details:
            if 'signature' in item:
                stored_features = item['signature']
                break
        
        if not stored_features:
            raise HTTPException(status_code=404, detail="Stored signature not found")
        
        # Compare signatures
        sift_score = signature_service.match_sift_features(new_features['sift_descriptors'], stored_features['sift_descriptors'])
        contour_score = signature_service.match_contour_features(new_features['contour_features'], stored_features['contour_features'])
        hu_score = signature_service.match_hu_moments(new_features['hu_moments'], stored_features['hu_moments'])
        final_score = signature_service.calculate_final_score(sift_score, contour_score, hu_score)
        
        if final_score < 0.3:  # Configurable threshold
            raise HTTPException(status_code=422, detail="Signature verification failed: Signatures do not match")
        
        return {"status": "Signature verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signature verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signature verification failed: {str(e)}")

@router.post("/restore/verify-seedkey")
async def verify_seedkey(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data or 'seedData' not in data:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        try:
            phone_number = decrypt_data(data['phoneNumber'])
            customer_id = decrypt_data(data['customerId'])
            seed_data = {
                "userId": decrypt_data(data['seedData']['userId']),
                "publicKey": decrypt_data(data['seedData']['publicKey']),
            }
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # Check if seedkey is currently locked BEFORE any attempt
        is_locked, unlock_time = SeedkeyAttemptService.is_seedkey_locked(db, customer_id)
        if is_locked:
            lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
            logger.warning(f"Seedkey verification attempted while locked for customer {customer_id}")
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Seedkey verification is locked due to multiple failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        # Verify seed key public key against seedkeys table
        seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id, Seedkey.user_id == seed_data['userId']).first()
        
        verification_success = False
        failure_reason = None
        
        if not seedkey:
            failure_reason = "Seed key not found for this customer"
        elif seedkey.public_key.lower() != seed_data['publicKey'].lower():
            failure_reason = "Seed key public key does not match stored key"
        else:
            verification_success = True
        
        # Log the attempt with proper success/failure
        SeedkeyAttemptService.log_seedkey_attempt(
            db=db,
            customer_id=customer_id,
            success=verification_success,
            ip_address=device_info["ip_address"],
            user_agent=device_info["user_agent"],
            device_info=device_info["device_info"],
            location=device_info["location"],
            failure_reason=failure_reason
        )
        
        if not verification_success:
            # Update failed attempts and check if blocked
            is_blocked, attempts_remaining = SeedkeyAttemptService.check_and_update_failed_attempts(db, customer_id, False)
            
            logger.warning(f"Seedkey verification failed for customer {customer_id}: {failure_reason}. Attempts remaining: {attempts_remaining}")
            
            # Send SMS notification for failed attempt
            try:
                SMSService.send_seedkey_attempt_notification(
                    db=db,
                    customer_id=customer_id,
                    attempts_remaining=attempts_remaining,
                    device_info=device_info["device_info"],
                    is_final_attempt=is_blocked
                )
            except Exception as sms_error:
                logger.error(f"Failed to send seedkey attempt SMS: {str(sms_error)}")
            
            if is_blocked:
                lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
                raise HTTPException(
                    status_code=423,
                    detail={
                        "message": "Seedkey verification locked for 24 hours after 3 failed attempts",
                        "lockout_info": lockout_info
                    }
                )
            
            raise HTTPException(
                status_code=422, 
                detail={
                    "message": failure_reason,
                    "attempts_remaining": attempts_remaining
                }
            )
        
        # Success - reset failed attempts 
        SeedkeyAttemptService.check_and_update_failed_attempts(db, customer_id, True)
        logger.info(f"Seedkey verification successful for customer {customer_id}")
        
        return {"status": "Seed key verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Seed key verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Seed key verification failed: {str(e)}")

@router.get("/restore/seedkey-status/{customer_id}")
async def get_seedkey_status(customer_id: str, db: Session = Depends(get_db)):
    """Get current seedkey lockout status for a customer"""
    try:
        lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
        return {
            "status": "success",
            "customer_id": customer_id,
            "seedkey_status": lockout_info
        }
    except Exception as e:
        logger.error(f"Failed to get seedkey status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get seedkey status: {str(e)}")



@router.post("/restore/log-mnemonic-attempt")
async def log_mnemonic_attempt(data: MnemonicAttemptRequest, http_request: Request, db: Session = Depends(get_db)):
    """Log a mnemonic verification attempt for CLIENT-SIDE failures (invalid format, derivation errors)"""
    try:
        customer_id = data.customerId
        
        # Check if already locked
        is_locked, unlock_time = SeedkeyAttemptService.is_seedkey_locked(db, customer_id)
        if is_locked:
            lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
            logger.warning(f"Client-side mnemonic attempt while locked for customer {customer_id}")
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Mnemonic verification locked due to multiple failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        # Log the attempt
        SeedkeyAttemptService.log_seedkey_attempt(
            db=db,
            customer_id=customer_id,
            success=data.success,
            ip_address=data.deviceInfo['ip_address'],
            user_agent=data.deviceInfo['user_agent'],
            device_info=data.deviceInfo['device_info'],
            location=data.deviceInfo['location'],
            failure_reason=data.failureReason
        )
        
        # Update attempt counter
        is_blocked, attempts_remaining = SeedkeyAttemptService.check_and_update_failed_attempts(db, customer_id, data.success)
        logger.info(f"Logged client-side mnemonic attempt for customer {customer_id}. Success: {data.success}, Blocked: {is_blocked}, Attempts remaining: {attempts_remaining}")
        
        # Send SMS for failures
        if not data.success:
            logger.warning(f"Client-side mnemonic verification failed for customer {customer_id}: {data.failureReason}. Attempts remaining: {attempts_remaining}")
            
            try:
                SMSService.send_seedkey_attempt_notification(
                    db=db,
                    customer_id=customer_id,
                    attempts_remaining=attempts_remaining,
                    device_info=data.deviceInfo['device_info'],
                    is_final_attempt=is_blocked
                )
                logger.info(f"SMS notification sent for client-side failed mnemonic attempt for customer {customer_id}")
            except Exception as sms_error:
                logger.error(f"Failed to send mnemonic attempt SMS: {str(sms_error)}")
        
        # Handle lockout
        if is_blocked:
            lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
            logger.warning(f"Client-side mnemonic verification locked for customer {customer_id}")
            raise HTTPException(
                status_code=423,
                detail={
                    "message": "Mnemonic verification locked for 24 hours after 3 failed attempts",
                    "lockout_info": lockout_info
                }
            )
        
        lockout_info = SeedkeyAttemptService.get_seedkey_lockout_info(db, customer_id)
        return {
            "status": "success",
            "is_blocked": is_blocked,
            "failed_attempts": lockout_info["failed_attempts"],
            "attempts_remaining": attempts_remaining,
            "locked_until": lockout_info["locked_until"],
            "lockout_duration_hours": SeedkeyAttemptService.LOCKOUT_DURATION_HOURS
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error logging client-side mnemonic attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error logging mnemonic attempt: {str(e)}")

