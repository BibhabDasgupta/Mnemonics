# Enhanced registration endpoints with proper device tracking and SMS notifications
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.user import (
    PhoneVerificationRequest,
    OTPVerificationRequest,
    CustomerCreate,
    AppDataCreate
)
from app.services.otp_service import decrypt_phone_number, decrypt_data
from app.services.fido_seedkey_service import start_fido_registration, register_fido_seedkey
from app.services import (otp_service, signature_service)
from app.services.sms_service import SMSService
from app.services.seedkey_attempt_service import SeedkeyAttemptService
from app.db.models.user import Account, AppData
from datetime import datetime
import uuid
from sqlalchemy.sql import text
from pydantic import EmailStr
import json
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

@router.post("/register/otp/send")
def send_otp(request: PhoneVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        phone_number = otp_service.decrypt_phone_number(
            request.encrypted_phone_number
        )
        
        customer = otp_service.check_phone_number(db, phone_number)
        
        if customer["status"] == "revoked":
            raise HTTPException(
                status_code=403,
                detail="Account access revoked. Please visit a branch to re-register."
            )
        if customer["status"] in ["registered", "preregistered"]:
            raise HTTPException(
                status_code=403,
                detail="Phone number already registered. Please proceed to restoration."
            )
        
        if customer["status"] == "fresh":
            raise HTTPException(
                status_code=403,
                detail="Create an account first before registering."
            )
            
        otp_service.send_otp(phone_number, customer["status"])
        
        return {
            "status": "OTP sent successfully",
            "phone_number": phone_number,
            "customer_id": customer["customer_id"],
            "verified": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration OTP send error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register/otp/verify")
def verify_otp(request: OTPVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        phone_number = otp_service.decrypt_phone_number(
            request.encrypted_phone_number
        )
        
        customer = otp_service.check_phone_number(db, phone_number)
        
        if customer["status"] == "revoked":
            raise HTTPException(
                status_code=403,
                detail="Account access revoked. Please visit a branch to re-register."
            )
        if customer["status"] in ["registered", "preregistered"]:
            raise HTTPException(
                status_code=403,
                detail="Phone number already registered. Please proceed to restoration."
            )
            
        if not otp_service.verify_otp(phone_number, request.otp_code):
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        customer_id = customer["customer_id"] or str(uuid.uuid4())
        
        return {
            "status": "OTP verified successfully",
            "phone_number": phone_number,
            "customer_id": customer_id,
            "verified": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration OTP verify error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register/complete")
async def complete_registration(customer_data: CustomerCreate, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        # Decrypt the incoming encrypted fields
        try:
            customer_id = otp_service.decrypt_data(customer_data.encrypted_customer_id)
            phone_number = otp_service.decrypt_data(customer_data.encrypted_phone_number)
            name = otp_service.decrypt_data(customer_data.encrypted_name)
            email = otp_service.decrypt_data(customer_data.encrypted_email)
            aadhaar_number = otp_service.decrypt_data(customer_data.encrypted_aadhaar_number)
            date_of_birth = otp_service.decrypt_data(customer_data.encrypted_date_of_birth)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        try:
            datetime.strptime(date_of_birth, '%Y-%m-%d')
        except ValueError as ve:
            raise HTTPException(status_code=422, detail="Invalid date format for date_of_birth, expected YYYY-MM-DD")
        
        # Verify details against accounts table
        query = text("""
            SELECT name, email, aadhaar_number, date_of_birth
            FROM accounts
            WHERE customer_unique_id = :customer_unique_id AND phone_number = :phone_number
        """)
        result = db.execute(query, {
            "customer_unique_id": customer_id,
            "phone_number": phone_number
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Account not found")
        
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
            raise HTTPException(status_code=422, detail="Details do not match account records")
        
        # Store in app_data table
        app_data = AppData(
            customer_id=customer_id,
            name=name,
            phone_number=phone_number,
            email=email,
            aadhaar_number=aadhaar_number,
            date_of_birth=datetime.strptime(date_of_birth, '%Y-%m-%d').date(),
            app_access_revoked=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(app_data)
        db.commit()
        
        return {"status": "Registration completed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Registration complete error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/register/device-check")
async def device_check(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data or 'checkType' not in data:
            raise HTTPException(status_code=400, detail="Missing phoneNumber, customerId, or checkType")
        
        try:
            phone_number = otp_service.decrypt_data(data['phoneNumber'])
            customer_id = otp_service.decrypt_data(data['customerId'])
            check_type = data['checkType']
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        if check_type not in ["sim", "phone"]:
            raise HTTPException(status_code=400, detail="Invalid checkType, must be 'sim' or 'phone'")
        
        current_data = None
        if check_type == "sim" and 'simData' in data:
            try:
                current_data = json.loads(otp_service.decrypt_data(data['simData']))
            except ValueError as e:
                raise HTTPException(status_code=422, detail=f"SIM data decryption failed: {str(e)}")
        elif check_type == "phone" and 'phoneData' in data:
            try:
                current_data = json.loads(otp_service.decrypt_data(data['phoneData']))
            except ValueError as e:
                raise HTTPException(status_code=422, detail=f"Phone data decryption failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail=f"Missing {check_type}Data")
        
        # Fetch stored data from accounts table
        column = 'last_simdata' if check_type == 'sim' else 'last_phonedata'
        query = text(f"""
            SELECT {column}
            FROM accounts
            WHERE customer_unique_id = :customer_unique_id AND phone_number = :phone_number
        """)
        result = db.execute(query, {
            "customer_unique_id": customer_id,
            "phone_number": phone_number
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Account not found")
        
        stored_data = None
        if result[0]:
            if isinstance(result[0], dict):
                stored_data = result[0]
            elif isinstance(result[0], str):
                try:
                    stored_data = json.loads(result[0])
                except json.JSONDecodeError as e:
                    raise HTTPException(status_code=500, detail=f"Invalid {column} format in database: {str(e)}")
            else:
                raise HTTPException(status_code=500, detail=f"Unexpected {column} type: {type(result[0])}")
        
        if stored_data is None:
            return {"status": "update_required"}
        
        if stored_data == current_data:
            return {"status": "match"}
        else:
            return {"status": "update_required"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device check failed: {str(e)}")

@router.post("/register/signature")
async def register_signature(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data or 'signature' not in data:
            raise HTTPException(status_code=400, detail="Missing phoneNumber, customerId, or signature")
        
        try:
            phone_number = otp_service.decrypt_data(data['phoneNumber'])
            customer_id = otp_service.decrypt_data(data['customerId'])
            signature_data = data['signature']  # Signature is sent unencrypted
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # Preprocess and extract features using signature_service
        img = signature_service.preprocess_signature(signature_data)
        features = signature_service.extract_all_features(img)
        
        # Store unencrypted features in app_data.other_details
        query = text("""
            UPDATE app_data
            SET other_details = :other_details,
                updated_at = :updated_at
            WHERE customer_id = :customer_id AND phone_number = :phone_number
            RETURNING id
        """)
        result = db.execute(query, {
            "customer_id": customer_id,
            "phone_number": phone_number,
            "other_details": json.dumps([{"signature": features}]),
            "updated_at": datetime.utcnow()
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="App data not found for customer")
        
        db.commit()
        return {"status": "Signature registered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Signature registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signature registration failed: {str(e)}")

@router.post("/register/fido-start")
async def fido_start_registration(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        if not data or 'customer_id' not in data:
            raise HTTPException(status_code=400, detail="Missing customer_id")
        
        try:
            customer_id = decrypt_data(data['customer_id'])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        return start_fido_registration(db, customer_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"FIDO registration start error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO registration start failed: {str(e)}")

@router.post("/register/fido-seedkey")
async def register_fido_seedkey_route(data: dict, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
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
        
        # Complete FIDO and seedkey registration
        await register_fido_seedkey(db, phone_number, customer_id, fido_data, seed_data)
        
        # Add device info to other_details for registration tracking
        try:
            SeedkeyAttemptService.add_device_info_to_other_details(
                db=db,
                customer_id=customer_id,
                action_type="registration",
                device_info=device_info["device_info"],
                location=device_info["location"],
                ip_address=device_info["ip_address"],
                additional_info={
                    "user_agent": device_info["user_agent"],
                    "registration_type": "fido_seedkey"
                }
            )
            logger.info(f"Registration device info tracked successfully for customer {customer_id}")
        except Exception as device_error:
            logger.error(f"Failed to track registration device info for customer {customer_id}: {str(device_error)}")
            # Don't fail registration due to tracking issues
        
        # Send SMS notification for successful registration
        try:
            SMSService.send_registration_notification(
                db=db,
                customer_id=customer_id,
                device_info=device_info["device_info"],
                location=device_info["location"],
                ip_address=device_info["ip_address"]
            )
            logger.info(f"Registration SMS sent successfully for customer {customer_id}")
        except Exception as sms_error:
            logger.error(f"Failed to send registration SMS for customer {customer_id}: {str(sms_error)}")
            # Don't fail the registration due to SMS issues
        
        return {"status": "FIDO2 and seed key registered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"FIDO seedkey registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO2 and seed key registration failed: {str(e)}")

@router.post("/register/device-complete")
async def complete_device_verification(data: PhoneVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    device_info = get_device_info(http_request)
    try:
        phone_number = otp_service.decrypt_data(data.encrypted_phone_number)
        
        # Update is_registeredinapp to True
        query = text("""
            UPDATE accounts
            SET is_registeredinapp = :is_registered
            WHERE phone_number = :phone_number
        """)
        db.execute(query, {
            "phone_number": phone_number,
            "is_registered": True
        })
        
        db.commit()
        
        logger.info(f"Device verification completed successfully for phone: {phone_number[:6]}****")
        return {"status": "Device verification completed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Device verification complete error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device verification failed: {str(e)}")

# Keep existing endpoints for customer phone and verification
@router.get("/customer/{customer_id}/phone")
async def get_customer_phone(customer_id: str, db: Session = Depends(get_db)):
    """Get phone number for a customer by customer_id from app_data table."""
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        query = text("""
            SELECT phone_number, app_access_revoked
            FROM app_data
            WHERE customer_id = :customer_id
        """)
        result = db.execute(query, {"customer_id": customer_id.strip()}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        if result.app_access_revoked:
            raise HTTPException(status_code=403, detail="Customer access has been revoked")
        
        if not result.phone_number:
            raise HTTPException(status_code=404, detail="Phone number not found for customer")
        
        return {
            "phone_number": result.phone_number,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer phone error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/customer/{customer_id}/verify")
async def verify_customer_exists(customer_id: str, db: Session = Depends(get_db)):
    """Verify if a customer exists and has valid app access."""
    try:
        if not customer_id or len(customer_id.strip()) == 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        
        query = text("""
            SELECT customer_id, name, app_access_revoked, created_at
            FROM app_data
            WHERE customer_id = :customer_id
        """)
        result = db.execute(query, {"customer_id": customer_id.strip()}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        if result.app_access_revoked:
            raise HTTPException(status_code=403, detail="Customer access has been revoked")
        
        return {
            "customer_id": result.customer_id,
            "name": result.name,
            "status": "active",
            "registered_date": result.created_at.isoformat() if result.created_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify customer error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/transaction/otp/send")
def send_transaction_otp(request: PhoneVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    """Send OTP for transaction verification (allows registered users)"""
    device_info = get_device_info(http_request)
    try:
        phone_number = otp_service.decrypt_phone_number(
            request.encrypted_phone_number
        )
        
        customer = otp_service.check_phone_number(db, phone_number)
        
        if customer["status"] == "revoked":
            raise HTTPException(
                status_code=403,
                detail="Account access revoked. Please visit a branch."
            )
        
        if customer["status"] == "fresh":
            raise HTTPException(
                status_code=404,
                detail="Customer not found in system."
            )
        
        otp_service.send_otp(phone_number, "transaction")
        
        return {
            "status": "Transaction OTP sent successfully",
            "phone_number": phone_number,
            "customer_id": customer["customer_id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transaction OTP send error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/otp/verify")
def verify_transaction_otp(request: OTPVerificationRequest, http_request: Request, db: Session = Depends(get_db)):
    """Verify OTP for transaction"""
    device_info = get_device_info(http_request)
    try:
        phone_number = otp_service.decrypt_phone_number(
            request.encrypted_phone_number
        )
        
        if not otp_service.verify_otp(phone_number, request.otp_code):
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        return {"status": "Transaction OTP verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transaction OTP verify error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))