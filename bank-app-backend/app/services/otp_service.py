# --- File: app/services/otp_service.py ---
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
import base64
from twilio.rest import Client
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from app.core.config import settings
from app.db.models.user import AppData
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def decrypt_data(encrypted_data: str) -> str:
    try:
        if not encrypted_data:
            raise ValueError("Encrypted data is empty")
        private_key = serialization.load_pem_private_key(
            settings.PRIVATE_KEY.encode(),
            password=None,
            backend=default_backend()
        )
        encrypted_bytes = base64.b64decode(encrypted_data)
        decrypted = private_key.decrypt(
            encrypted_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        decrypted_value = decrypted.decode('utf-8')
        logger.debug(f"Decrypted data: {decrypted_value}")
        return decrypted_value
    except Exception as e:
        logger.error(f"Decryption error for data '{encrypted_data}': {str(e)}")
        raise ValueError(f"Decryption failed: {str(e)}")

def decrypt_phone_number(encrypted_data: str) -> str:
    return decrypt_data(encrypted_data)

def check_phone_number(db: Session, phone_number: str) -> dict:
    try:
        query = text("""
            SELECT customer_unique_id as customer_id, is_registeredinapp
            FROM accounts
            WHERE phone_number = :phone_number
        """)
        result = db.execute(query, {"phone_number": phone_number}).fetchone()
        
        if not result:
            return {"status": "fresh", "customer_id": None}

        if not result.is_registeredinapp:
            return {"status": "new", "customer_id": result.customer_id}
        
        app_data_query = text("""
            SELECT app_access_revoked
            FROM app_data
            WHERE phone_number = :phone_number
        """)
        app_data = db.execute(app_data_query, {"phone_number": phone_number}).fetchone()
        
        if app_data and app_data.app_access_revoked:
            return {"status": "revoked", "customer_id": result.customer_id}
        
        return {"status": "registered", "customer_id": result.customer_id}
        
    except Exception as e:
        logger.error(f"Database error checking phone number: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

def send_otp(phone_number: str, customer_status: str) -> None:
    if customer_status in ["registered", "revoked"]:
        raise HTTPException(
            status_code=403,
            detail="OTP cannot be sent for registered or revoked accounts"
        )
    
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        verification = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verifications.create(to=phone_number, channel="sms")
        
        if verification.status != "pending":
            logger.error(f"Twilio verification failed: {verification.status}")
            raise HTTPException(status_code=400, detail="Failed to send OTP")
            
    except Exception as e:
        logger.error(f"Twilio error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error sending OTP")

def verify_otp(phone_number: str, otp_code: str) -> bool:
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        verification_check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks.create(to=phone_number, code=otp_code)
        
        return verification_check.status == "approved"
        
    except Exception as e:
        logger.error(f"Twilio verification error: {str(e)}")
        raise HTTPException(status_code=400, detail="Error verifying OTP")