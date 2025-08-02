from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.user import (
    PhoneVerificationRequest,
    OTPVerificationRequest,
    CustomerCreate,
    AppDataCreate
)
from app.services import (otp_service, signature_service)
from app.db.models.user import Account, AppData
from datetime import datetime
import uuid
from sqlalchemy.sql import text
from pydantic import EmailStr
import json

router = APIRouter()

@router.post("/register/otp/send")
def send_otp(request: PhoneVerificationRequest, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register/otp/verify")
def verify_otp(request: OTPVerificationRequest, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register/complete")
async def complete_registration(customer_data: CustomerCreate, db: Session = Depends(get_db)):
    try:
        # Log incoming payload
        # print(f"Incoming payload: {customer_data.dict()}")

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
        
        # print(f"Decrypted data: customer_id={customer_id}, phone_number={phone_number}, name={name}, email={email}, aadhaar_number={aadhaar_number}, date_of_birth={date_of_birth}")
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
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")



@router.post("/register/device-check")
async def device_check(data: dict, db: Session = Depends(get_db)):
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
                # Handle case where ORM deserializes JSON into a dict
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
        raise HTTPException(status_code=500, detail=f"Device check failed: {str(e)}")


@router.post("/register/signature")
async def register_signature(data: dict, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=500, detail=f"Signature registration failed: {str(e)}")
    


@router.post("/register/device-complete")
async def complete_device_verification(data: PhoneVerificationRequest, db: Session = Depends(get_db)):
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
        return {"status": "Device verification completed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Device verification failed: {str(e)}")