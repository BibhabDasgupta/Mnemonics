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
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from cbor2 import dumps
import binascii


def der_to_cose_key(der_public_key: bytes) -> bytes:
    """
    Convert a DER-encoded ECDSA public key to CBOR-encoded COSE key format.
    """
    try:
        # Load the DER-encoded public key
        public_key = load_der_public_key(der_public_key)
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Public key is not an ECDSA key")

        # Verify the curve is P-256
        if not isinstance(public_key.curve, ec.SECP256R1):
            raise ValueError("Public key is not on the P-256 curve")

        # Extract x and y coordinates
        numbers = public_key.public_numbers()
        x = numbers.x.to_bytes(32, byteorder="big")  # P-256 uses 32-byte coordinates
        y = numbers.y.to_bytes(32, byteorder="big")

        # Construct COSE key (EC2, P-256, ES256)
        cose_key = {
            1: 2,  # kty: EC2
            3: -7,  # alg: ES256
            -1: 1,  # crv: P-256
            -2: x,  # x coordinate
            -3: y,  # y coordinate
        }

        # Encode as CBOR
        return dumps(cose_key)
    except Exception as e:
        raise ValueError(f"Failed to convert DER to COSE key: {str(e)}")
    

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



def start_fido_login(db: Session, customer_id: str):
    # print(customer_id)
    query = text("SELECT customer_id, email, name FROM app_data WHERE customer_id = :customer_id")
    result = db.execute(query, {"customer_id": customer_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="User not found or has no registered devices.")

    customer_id, email, name = result 
    passkeys = db.query(Passkey).filter(Passkey.customer_id == customer_id).all()
    if not passkeys:
        raise HTTPException(status_code=404, detail="No registered devices found.")

    allowed_credentials = []
    for pk in passkeys:
        try:
            # Ensure credential_id is bytes
            credential_id_bytes = pk.credential_id if isinstance(pk.credential_id, bytes) else base64url_to_bytes(pk.credential_id)
            allowed_credentials.append({
                "type": "public-key",
                "id": credential_id_bytes,  # Keep as bytes for webauthn library
                "transports": ["internal"]
            })
        except Exception as e:
            print(f"Error processing credential ID for passkey {pk.id}: {e}")
            continue

    if not allowed_credentials:
        raise HTTPException(status_code=404, detail="No valid credentials found.")

    try:
        auth_options = generate_authentication_options(
            rp_id=settings.RP_ID,
            allow_credentials=allowed_credentials,
            user_verification="required",
        )
    except Exception as e:
        print(f"Error generating auth options: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate authentication options: {str(e)}")

    challenge_hex = auth_options.challenge.hex()
    challenge_service.create_challenge(
        db=db,
        challenge=challenge_hex,
        customer_id=customer_id,
        challenge_type=ChallengeType.FIDO2,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )

    # Fix: Convert credential IDs to base64url for the response
    formatted_credentials = []
    for cred in allowed_credentials:
        try:
            formatted_credentials.append({
                "type": cred["type"],
                "id": bytes_to_base64url(cred["id"]),  # Convert bytes to base64url for client
                "transports": cred.get("transports", ["internal"])
            })
        except Exception as e:
            print(f"Error formatting credential: {e}")
            continue

    return {
        "challenge": bytes_to_base64url(auth_options.challenge),
        "timeout": auth_options.timeout,
        "rpId": auth_options.rp_id,
        "allowCredentials": formatted_credentials,  # Use the properly formatted credentials
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

    # Validate credential structure
    required_fields = ['id', 'rawId', 'type', 'response']
    response_fields = ['clientDataJSON', 'authenticatorData', 'signature']
    
    if not all(field in credential for field in required_fields):
        missing_fields = [field for field in required_fields if field not in credential]
        raise HTTPException(status_code=400, detail=f"Missing credential fields: {missing_fields}")
    
    if not all(field in credential['response'] for field in response_fields):
        missing_response_fields = [field for field in response_fields if field not in credential['response']]
        raise HTTPException(status_code=400, detail=f"Missing credential response fields: {missing_response_fields}")

    try:
        response_dict = credential['response']
        for field in response_fields:
            if not isinstance(response_dict[field], str):
                raise HTTPException(status_code=400, detail=f"Field {field} must be a string")
        
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

    try:
        client_data_str = parsed_credential.response.client_data_json.decode('utf-8')
        client_data_dict = json.loads(client_data_str)
        challenge_from_client_b64url = client_data_dict['challenge']
        challenge_hex = base64url_to_bytes(challenge_from_client_b64url).hex()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract challenge from client data: {str(e)}")

    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge_hex)
    if not db_challenge or db_challenge.customer_id != customer_id or db_challenge.challenge_type != ChallengeType.FIDO2:
        raise HTTPException(status_code=400, detail="Invalid FIDO2 challenge.")

    try:
        credential_id_bytes = base64url_to_bytes(credential['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credential ID format: {str(e)}")

    passkey = db.query(Passkey).filter(Passkey.credential_id == credential_id_bytes).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="This security key is not registered.")

    try:
        credential_id_bytes = base64url_to_bytes(credential['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credential ID format: {str(e)}")

    passkey = db.query(Passkey).filter(Passkey.credential_id == credential_id_bytes).first()
    if not passkey:
        raise HTTPException(status_code=404, detail="This security key is not registered.")

    try:
        public_key_bytes = passkey.public_key
        if not isinstance(public_key_bytes, bytes):
            raise HTTPException(status_code=500, detail="Public key is not in correct bytes format")
        
        # Convert DER to COSE key
        cose_key_bytes = der_to_cose_key(public_key_bytes)
        
        # Debug: Print the COSE key
        from cbor2 import loads
        try:
            decoded_cose_key = loads(cose_key_bytes)
            print(f"Debug: Converted COSE key: {decoded_cose_key}")
        except Exception as e:
            print(f"Debug: Failed to decode COSE key: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Invalid COSE key format: {str(e)}")
        
        expected_origin = http_request.headers.get("origin") or "http://localhost:8080"
        # print(f"Debug: public_key_bytes type: {type(public_key_bytes)}, length: {len(public_key_bytes)}")
        # print(f"Debug: challenge type: {type(bytes.fromhex(db_challenge.challenge_string))}")
        # print(f"Debug: passkey.sign_count type: {type(passkey.sign_count)}")
        
        auth_verification = verify_authentication_response(
            credential=parsed_credential,
            expected_challenge=bytes.fromhex(db_challenge.challenge_string),
            expected_rp_id=settings.RP_ID,
            expected_origin=expected_origin,
            credential_public_key=cose_key_bytes,  # Use COSE key
            credential_current_sign_count=int(passkey.sign_count),
            require_user_verification=True,
        )
        
        passkey.sign_count = int(auth_verification.new_sign_count)
        db.commit()

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

        # print(passkey.symmetric_key)
        
        return {
            "status": "fido_verified",
            "symmetric_key": passkey.symmetric_key,
            "seed_challenge": seed_challenge,
            "customer_id": customer_id
        }
    except Exception as e:
        print(f"FIDO2 authentication error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"FIDO2 authentication failed: {str(e)}")


def verify_seedkey_signature(db: Session, customer_id: str, challenge: str, public_key: str):
    """
    Verify the seed key by comparing the provided public key with the stored public key.
    """
    # Validate challenge for flow integrity
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge)
    if not db_challenge or db_challenge.customer_id != customer_id or db_challenge.challenge_type != ChallengeType.SEEDKEY:
        raise HTTPException(status_code=400, detail="Invalid seed key challenge.")

    seedkey = db.query(Seedkey).filter(Seedkey.customer_id == customer_id).first()
    if not seedkey:
        raise HTTPException(status_code=404, detail="Seed key not found.")

    try:
        # Compare received public key with stored public key
        if public_key.lower() != seedkey.public_key.lower():
            raise ValueError("Public key does not match stored key")

        db.commit()
        return {"status": "seedkey_verified", "customer_id": customer_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Seed key verification failed: {str(e)}")



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



def get_customer_by_id(db: Session, customer_id: str):
    """
    Get customer information by customer ID.
    """
    try:
        query = text("SELECT customer_id, email, name FROM app_data WHERE customer_id = :customer_id")
        result = db.execute(query, {"customer_id": customer_id}).fetchone()
        if not result:
            return None
        
        return {
            "customer_id": result.customer_id,
            "email": result.email,
            "name": result.name
        }
    except Exception as e:
        print(f"Error getting customer by ID: {str(e)}")
        return None


def update_login_metadata(db: Session, customer_id: str):
    """
    Update login metadata for the customer.
    Increment the number of logged in devices by 1.
    """
    try:
        # Increment no_of_logged_in_devices by 1
        query = text("""
            UPDATE app_data 
            SET no_of_logged_in_devices = COALESCE(no_of_logged_in_devices, 0) + 1
            WHERE customer_id = :customer_id
        """)
        
        db.execute(query, {"customer_id": customer_id})
        db.commit()
        return True
    except Exception as e:
        print(f"Error updating login metadata: {str(e)}")
        db.rollback()
        return False



def decrease_login_metadata(db: Session, customer_id: str):
    """
    Update login metadata for the customer on logout.
    Decrease the number of logged in devices by 1 (minimum 0).
    """
    try:
        query = text("""
            UPDATE app_data 
            SET no_of_logged_in_devices = GREATEST(COALESCE(no_of_logged_in_devices, 0) - 1, 0)
            WHERE customer_id = :customer_id
        """)
        
        result = db.execute(query, {"customer_id": customer_id})
        db.commit()
        
        if result.rowcount > 0:
            print(f"Successfully decreased login count for customer {customer_id}")
            return True
        else:
            print(f"No customer found with ID {customer_id} during logout")
            return False
            
    except Exception as e:
        print(f"Error decreasing login metadata: {str(e)}")
        db.rollback()
        return False


from app.services import challenge_service