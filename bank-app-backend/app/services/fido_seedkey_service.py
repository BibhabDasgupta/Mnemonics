from sqlalchemy.orm import Session
from app.db.models.user import Passkey, Seedkey, AppData
from app.db.models.challenge import Challenge, ChallengeType
from webauthn import generate_registration_options, verify_registration_response, generate_authentication_options, verify_authentication_response
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import RegistrationCredential, AuthenticationCredential, AuthenticatorAttestationResponse, AuthenticatorAssertionResponse
from fastapi import HTTPException, Request
from datetime import datetime, timedelta
from sqlalchemy.sql import text
import json
import jwt
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from app.core.config import settings
from cryptography.hazmat.primitives.serialization import load_der_public_key

def start_fido_registration(db: Session, customer_id: str):
    query = text("SELECT id, email FROM app_data WHERE customer_id = :customer_id")
    result = db.execute(query, {"customer_id": customer_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")

    user_id_bytes = customer_id.encode('utf-8')
    registration_options = generate_registration_options(
        rp_id="localhost",
        rp_name="Bank",
        user_id=user_id_bytes,
        user_name=result.email or customer_id,
        user_display_name=result.email or customer_id,
    )

    return {
        "rp": {"id": registration_options.rp.id, "name": registration_options.rp.name},
        "user": {
            "id": bytes_to_base64url(registration_options.user.id),
            "name": registration_options.user.name,
            "displayName": registration_options.user.display_name,
        },
        "challenge": bytes_to_base64url(registration_options.challenge),
        "pubKeyCredParams": [
            {"type": param.type, "alg": param.alg} for param in registration_options.pub_key_cred_params
        ],
        "timeout": registration_options.timeout,
        "excludeCredentials": [
            {"type": cred.type, "id": bytes_to_base64url(cred.id)} for cred in registration_options.exclude_credentials
        ],
        "authenticatorSelection": {
            "authenticatorAttachment": registration_options.authenticator_selection.authenticator_attachment if registration_options.authenticator_selection else None,
            "requireResidentKey": registration_options.authenticator_selection.require_resident_key if registration_options.authenticator_selection else False,
            "residentKey": registration_options.authenticator_selection.resident_key if registration_options.authenticator_selection else None,
            "userVerification": registration_options.authenticator_selection.user_verification if registration_options.authenticator_selection else "preferred",
        },
        "attestation": registration_options.attestation,
    }

async def register_fido_seedkey(db: Session, phone_number: str, customer_id: str, fido_data: dict, seed_data: dict):
    query = text("SELECT id FROM app_data WHERE customer_id = :customer_id AND phone_number = :phone_number")
    result = db.execute(query, {"customer_id": customer_id, "phone_number": phone_number}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found in app_data")

    try:
        # Convert base64url-encoded strings to bytes for BYTEA columns
        credential_id_bytes = base64url_to_bytes(fido_data['credentialId'])
        public_key_bytes = base64url_to_bytes(fido_data['publicKey'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64url format for FIDO data: {str(e)}")

    passkey = Passkey(
        customer_id=customer_id,
        credential_id=credential_id_bytes,
        public_key=public_key_bytes,
        symmetric_key=fido_data['symmetricKey'],  # Store as string (TEXT)
        sign_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(passkey)

    seedkey = Seedkey(
        customer_id=customer_id,
        public_key=seed_data['publicKey'],  # Store as string (TEXT)
        user_id=seed_data['userId'],
        created_at=datetime.utcnow(),
    )

    db.add(seedkey)

    db.commit()



# def start_fido_login(db: Session, customer_id: str):
#     print(customer_id)
#     query = text("SELECT customer_id, email, name FROM app_data WHERE customer_id = :customer_id")
#     result = db.execute(query, {"customer_id": customer_id}).fetchone()
#     if not result:
#         raise HTTPException(status_code=404, detail="User not found or has no registered devices.")

#     customer_id, email, name = result 
#     passkeys = db.query(Passkey).filter(Passkey.customer_id == customer_id).all()
#     if not passkeys:
#         raise HTTPException(status_code=404, detail="No registered devices found.")

#     allowed_credentials = [{"type": "public-key", "id": base64url_to_bytes(pk.credential_id), "transports": ["internal"]} for pk in passkeys]

#     auth_options = generate_authentication_options(
#         rp_id=settings.RP_ID,
#         allow_credentials=allowed_credentials,
#         user_verification="required",
        
#     )

#     challenge_hex = auth_options.challenge.hex()
#     challenge_service.create_challenge(
#         db=db,
#         challenge=challenge_hex,
#         customer_id=customer_id,
#         challenge_type=ChallengeType.FIDO2,
#         expires_at=datetime.utcnow() + timedelta(minutes=5)
#     )
    
#     return {
#         "challenge": bytes_to_base64url(auth_options.challenge),
#         "timeout": auth_options.timeout,
#         "rpId": auth_options.rp_id,
#         "allowCredentials": [
#             {"type": cred['type'], "id": bytes_to_base64url(cred['id'])}
#             for cred in allowed_credentials
#         ],
#         "userVerification": auth_options.user_verification,
#         "user": {
#             "id": bytes_to_base64url(customer_id.encode('utf-8')),
#             "name": email,
#             "displayName": name
#         },
#         "customerId": customer_id
#     }


def start_fido_login(db: Session, customer_id: str):
    print(customer_id)
    query = text("SELECT customer_id, email, name FROM app_data WHERE customer_id = :customer_id")
    result = db.execute(query, {"customer_id": customer_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="User not found or has no registered devices.")

    customer_id, email, name = result 
    passkeys = db.query(Passkey).filter(Passkey.customer_id == customer_id).all()
    if not passkeys:
        raise HTTPException(status_code=404, detail="No registered devices found.")

    # ✅ Fixed: Convert BYTEA credential_id back to base64url for client
    allowed_credentials = [
        {
            "type": "public-key", 
            "id": base64url_to_bytes(bytes_to_base64url(pk.credential_id)),  # Ensure proper conversion
            "transports": ["internal"]  # Hint for platform authenticators
        } 
        for pk in passkeys
    ]
    
    auth_options = generate_authentication_options(
        rp_id=settings.RP_ID,
        allow_credentials=allowed_credentials,
        user_verification="required",  # ✅ Force user verification
    )

    challenge_hex = auth_options.challenge.hex()
    challenge_service.create_challenge(
        db=db,
        challenge=challenge_hex,
        customer_id=customer_id,
        challenge_type=ChallengeType.FIDO2,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    
    return {
        "challenge": bytes_to_base64url(auth_options.challenge),
        "timeout": auth_options.timeout,
        "rpId": auth_options.rp_id,
        "allowCredentials": [
            {
                "type": cred["type"], 
                "id": bytes_to_base64url(cred["id"]),
                "transports": cred.get("transports", ["internal"])  # Include transport hints
            }
            for cred in allowed_credentials
        ],
        "userVerification": auth_options.user_verification,
        "user": {
            "id": bytes_to_base64url(customer_id.encode('utf-8')),
            "name": email,
            "displayName": name
        },
        "customerId": customer_id
    }
    

def finish_fido_login(db: Session, http_request: Request, customer_id: str, credential: dict):
    query = text("SELECT customer_id FROM app_data WHERE customer_id = :customer_id")
    result = db.execute(query, {"customer_id": customer_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found.")

    try:
        response_dict = credential['response']
        parsed_response = AuthenticatorAssertionResponse(
            client_data_json=base64url_to_bytes(response_dict['clientDataJSON']),
            authenticator_data=base64url_to_bytes(response_dict['authenticatorData']),
            signature=base64url_to_bytes(response_dict['signature']),
            user_handle=base64url_to_bytes(response_dict['userHandle']) if response_dict.get('userHandle') else None,
        )

        parsed_credential = AuthenticationCredential(
            id=credential['id'],
            raw_id=base64url_to_bytes(credential['rawId']),
            response=parsed_response,
            type=credential['type'],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse credential: {str(e)}")

    client_data_str = parsed_credential.response.client_data_json.decode('utf-8')
    client_data_dict = json.loads(client_data_str)
    challenge_from_client_b64url = client_data_dict['challenge']
    challenge_hex = base64url_to_bytes(challenge_from_client_b64url).hex()

    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge_hex)
    if not db_challenge or db_challenge.customer_id != customer_id or db_challenge.challenge_type != ChallengeType.FIDO2:
        raise HTTPException(status_code=400, detail="Invalid FIDO2 challenge.")

    passkey = db.query(Passkey).filter(Passkey.credential_id == parsed_credential.id).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="This security key is not registered.")

    try:
        auth_verification = verify_authentication_response(
            credential=parsed_credential,
            expected_challenge=bytes.fromhex(db_challenge.challenge_string),
            expected_rp_id=settings.RP_ID,
            expected_origin=http_request.headers.get("origin") or "http://localhost:8080",
            credential_public_key=base64url_to_bytes(passkey.public_key),
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
        passkey.sign_count = auth_verification.new_sign_count
        db.commit()

        # Generate seed key challenge
        seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id).first()
        if not seedkey:
            raise HTTPException(status_code=404, detail="Seed key not found.")

        seed_challenge = challenge_service.generate_challenge()
        challenge_service.create_challenge(
            db=db,
            challenge=seed_challenge,
            customer_id=customer_id,
            challenge_type=ChallengeType.SEEDKEY,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )

        return {
            "status": "fido_verified",
            "symmetric_key": passkey.symmetric_key,
            "seed_challenge": seed_challenge,
            "customer_id": customer_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"FIDO2 authentication failed: {str(e)}")

def verify_seedkey_signature(db: Session, customer_id: str, challenge: str, signature: str):
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge)
    if not db_challenge or db_challenge.customer_id != customer_id or db_challenge.challenge_type != ChallengeType.SEEDKEY:
        raise HTTPException(status_code=400, detail="Invalid seed key challenge.")

    seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id).first()
    if not seedkey:
        raise HTTPException(status_code=404, detail="Seed key not found.")

    try:
        public_key_bytes = bytes.fromhex(seedkey.public_key)
        public_key = load_der_public_key(public_key_bytes)
        signature_bytes = base64.b64decode(signature)
        public_key.verify(
            signature_bytes,
            challenge.encode('utf-8'),
            ec.ECDSA(hashes.SHA256())
        )
        db.commit()
        return {"status": "seedkey_verified", "customer_id": customer_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Seed key signature verification failed: {str(e)}")



def start_seedkey_restoration(db: Session, user_id: str):
    seedkey = db.query(Seedkey).filter(Seedkey.user_id == user_id).first()
    if not seedkey:
        raise HTTPException(status_code=404, detail="Seed key not found.")

    from app.services import challenge_service
    challenge = challenge_service.generate_challenge()
    challenge_service.create_challenge(
        db=db,
        challenge=challenge,
        customer_id=seedkey.customer_id,
        challenge_type=ChallengeType.SEEDKEY,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )

    return {
        "challenge": challenge,
        "customer_id": seedkey.customer_id
    }


def start_seedkey_restoration(db: Session, user_id: str):
    seedkey = db.query(Seedkey).filter(Seedkey.user_id == user_id).first()
    if not seedkey:
        raise HTTPException(status_code=404, detail="Seed key not found.")

    challenge = challenge_service.generate_challenge()
    challenge_service.create_challenge(
        db=db,
        challenge=challenge,
        customer_id=seedkey.customer_id,
        challenge_type=ChallengeType.SEEDKEY,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )

    return {
        "challenge": challenge,
        "customer_id": seedkey.customer_id
    }

async def finish_seedkey_restoration(db: Session, customer_id: str, user_id: str, signature: str, challenge: str, new_fido_data: dict):
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge)
    if not db_challenge or db_challenge.customer_id != customer_id or db_challenge.challenge_type != ChallengeType.SEEDKEY:
        raise HTTPException(status_code=400, detail="Invalid seed key challenge.")

    seedkey = db.query(Seedkey).filter(Seedkey.user_id == user_id, Seedkey.customer_id == customer_id).first()
    if not seedkey:
        raise HTTPException(status_code=404, detail="Seed key not found.")

    try:
        public_key_bytes = bytes.fromhex(seedkey.public_key)
        public_key = load_der_public_key(public_key_bytes)
        signature_bytes = base64.b64decode(signature)
        public_key.verify(
            signature_bytes,
            challenge.encode('utf-8'),
            ec.ECDSA(hashes.SHA256())
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Seed key signature verification failed: {str(e)}")

    # Register new FIDO2 credential
    passkey = Passkey(
        customer_id=customer_id,
        credential_id=base64url_to_bytes(new_fido_data['credentialId']),
        public_key=base64url_to_bytes(new_fido_data['publicKey']),
        symmetric_key=new_fido_data['symmetricKey'],
        sign_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(passkey)
    db.commit()

    return {"status": "restoration_completed", "customer_id": customer_id}

from app.services import challenge_service