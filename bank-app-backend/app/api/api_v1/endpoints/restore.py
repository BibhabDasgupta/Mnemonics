from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.user import PhoneVerificationRequest, CustomerCreate, FidoLoginStartRequest
from app.services.fido_seedkey_service import start_fido_registration, register_fido_seedkey
from app.services.otp_service import decrypt_phone_number, check_phone_number, decrypt_data
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from app.services import signature_service
from app.db.models.user import AppData, Seedkey, Passkey
from sqlalchemy.sql import text
import logging
from sqlalchemy.sql import text
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/restore/check")
async def check_restoration_phone(request: PhoneVerificationRequest, db: Session = Depends(get_db)):
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
async def complete_restoration(customer_data: CustomerCreate, db: Session = Depends(get_db)):
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
async def fido_start_restoration(data: FidoLoginStartRequest, db: Session = Depends(get_db)):
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
async def restore_fido_seedkey(data: dict, db: Session = Depends(get_db)):
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
        
        # Verify seed key public key against seedkeys table
        seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id, Seedkey.user_id == seed_data['userId']).first()
        if not seedkey:
            raise HTTPException(status_code=404, detail="Seed key not found for this customer")
        
        if seedkey.public_key.lower() != seed_data['publicKey'].lower():
            raise HTTPException(status_code=422, detail="Seed key public key does not match stored key")
        
        # Store new FIDO2 passkey
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
        
        return {"status": "FIDO2 and seed key restored successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"FIDO2 and seed key restoration failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FIDO2 and seed key restoration failed: {str(e)}")




@router.post("/restore/check-signature")
async def check_signature(data: dict, db: Session = Depends(get_db)):
    try:
        if not data or 'phoneNumber' not in data or 'customerId' not in data:
            raise HTTPException(status_code=400, detail="Missing phoneNumber or customerId")
        
        try:
            phone_number = decrypt_data(data['phoneNumber'])
            customer_id = decrypt_data(data['customerId'])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Decryption failed: {str(e)}")
        
        # Check app_data for signature in other_details
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
async def verify_signature(data: dict, db: Session = Depends(get_db)):
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
async def verify_seedkey(data: dict, db: Session = Depends(get_db)):
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
        
        # Verify seed key public key against seedkeys table
        seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id, Seedkey.user_id == seed_data['userId']).first()
        if not seedkey:
            raise HTTPException(status_code=404, detail="Seed key not found for this customer")
        
        if seedkey.public_key.lower() != seed_data['publicKey'].lower():
            raise HTTPException(status_code=422, detail="Seed key public key does not match stored key")
        
        return {"status": "Seed key verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Seed key verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Seed key verification failed: {str(e)}")