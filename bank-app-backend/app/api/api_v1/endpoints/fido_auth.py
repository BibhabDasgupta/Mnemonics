from fastapi import APIRouter, Depends, HTTPException, Body, Request
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from webauthn import (
    generate_registration_options, verify_registration_response,
    generate_authentication_options, verify_authentication_response
)
from webauthn.helpers.structs import (
    RegistrationCredential, AuthenticationCredential, AuthenticatorAttestationResponse,
    AuthenticatorAssertionResponse
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from datetime import datetime, timedelta
import json

from app.db.base import get_db
from app.services import user_service, challenge_service
from app.core.config import settings
from app.db.models.challenge import ChallengeType

router = APIRouter()

#
# Pydantic Models: Defines the exact JSON contract with the frontend.
#
class RPModel(BaseModel):
    id: str
    name: str

class UserModel(BaseModel):
    id: str
    name: str
    display_name: str = Field(alias="displayName")

class CredentialDescriptorModel(BaseModel):
    type: str
    id: str

class PubKeyCredParamModel(BaseModel):
    type: str
    alg: int

class AuthenticatorSelectionModel(BaseModel):
    authenticator_attachment: Optional[str] = Field(None, alias="authenticatorAttachment")
    require_resident_key: bool = Field(alias="requireResidentKey")
    resident_key: Optional[str] = Field(None, alias="residentKey")
    user_verification: str = Field(alias="userVerification")

class FidoRegisterStartResponse(BaseModel):
    rp: RPModel
    user: UserModel
    challenge: str
    pub_key_cred_params: List[PubKeyCredParamModel] = Field(alias="pubKeyCredParams")
    timeout: int
    exclude_credentials: List[CredentialDescriptorModel] = Field(alias="excludeCredentials")
    authenticator_selection: AuthenticatorSelectionModel = Field(alias="authenticatorSelection")
    attestation: str

class FidoLoginStartResponse(BaseModel):
    challenge: str
    timeout: int
    rp_id: str = Field(alias="rpId")
    allow_credentials: List[dict] = Field(alias="allowCredentials")
    user_verification: str = Field(alias="userVerification")
    user: UserModel
    customer_id: str = Field(alias="customerId") # The plain UUID for our app's logic

class FidoRegisterStartRequest(BaseModel):
    customer_id: str
class FidoRegisterFinishRequest(BaseModel):
    customer_id: str
    credential: str
class FidoLoginStartRequest(BaseModel):
    email: EmailStr
class FidoLoginFinishRequest(BaseModel):
    customer_id: str
    credential: str


#
# API Endpoints
#

@router.post("/fido/register/start", response_model=FidoRegisterStartResponse, summary="Start FIDO2 device registration")
def start_fido_registration(request: FidoRegisterStartRequest, db: Session = Depends(get_db)):
    customer = user_service.get_customer_by_id(db, customer_id=request.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    user_id_bytes = customer.customer_id.encode('utf-8')

    registration_options = generate_registration_options(
        rp_id=settings.RP_ID, rp_name="NE-Finance", user_id=user_id_bytes,
        user_name=customer.email,
        exclude_credentials=[{"type": "public-key", "id": pk.credential_id} for pk in customer.passkeys],
    )

    challenge_hex = registration_options.challenge.hex()
    challenge_service.create_challenge(
        db=db, challenge=challenge_hex, customer_id=customer.customer_id,
        challenge_type=ChallengeType.FIDO2, expires_at=datetime.utcnow() + timedelta(minutes=5)
    )

    # --- THIS IS THE DEFINITIVE FIX ---
    # Manually and safely build the dictionary, checking for None.
    auth_selection = registration_options.authenticator_selection
    response_data = {
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
            "authenticatorAttachment": auth_selection.authenticator_attachment if auth_selection else None,
            "requireResidentKey": auth_selection.require_resident_key if auth_selection else False,
            "residentKey": auth_selection.resident_key if auth_selection else None,
            "userVerification": auth_selection.user_verification if auth_selection else "preferred",
        },
        "attestation": registration_options.attestation,
    }
    return FidoRegisterStartResponse(**response_data)


@router.post("/fido/register/finish", summary="Finish FIDO2 device registration")
def finish_fido_registration(
    http_request: Request,
    request: FidoRegisterFinishRequest,
    db: Session = Depends(get_db)
):
    customer = user_service.get_customer_by_id(db, customer_id=request.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        credential_dict = json.loads(request.credential)
        response_dict = credential_dict['response']

        parsed_response = AuthenticatorAttestationResponse(
            client_data_json=base64url_to_bytes(response_dict['clientDataJSON']),
            attestation_object=base64url_to_bytes(response_dict['attestationObject']),
        )
        parsed_credential = RegistrationCredential(
            id=credential_dict['id'],
            raw_id=base64url_to_bytes(credential_dict['rawId']),
            response=parsed_response,
            type=credential_dict['type'],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse incoming credential: {e}")

    client_data_str = parsed_credential.response.client_data_json.decode('utf-8')
    client_data_dict = json.loads(client_data_str)
    challenge_from_client_b64url = client_data_dict['challenge']
    challenge_hex = base64url_to_bytes(challenge_from_client_b64url).hex()
    
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge_hex)
    if not db_challenge or db_challenge.customer_id != customer.customer_id:
        raise HTTPException(status_code=400, detail="Challenge is invalid or expired.")

    try:
        reg_verification = verify_registration_response(
            credential=parsed_credential,
            expected_challenge=bytes.fromhex(db_challenge.challenge_string),
            expected_origin=http_request.headers.get("origin"),
            expected_rp_id=settings.RP_ID,
            require_user_verification=True,
        )
        user_service.add_passkey_to_customer(
            db=db, customer=customer, credential_id=reg_verification.credential_id,
            public_key=reg_verification.credential_public_key, sign_count=reg_verification.sign_count,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration verification failed: {e}")


@router.post("/fido/login/start", response_model=FidoLoginStartResponse, summary="Start FIDO2 login")
def start_fido_login(request: FidoLoginStartRequest, db: Session = Depends(get_db)):
    customer = user_service.get_customer_by_email(db, email=request.email)
    if not customer or not customer.passkeys:
        raise HTTPException(status_code=404, detail="User not found or has no registered devices.")

    allowed_credentials = [{"type": "public-key", "id": pk.credential_id} for pk in customer.passkeys]
    
    auth_options = generate_authentication_options(
        rp_id=settings.RP_ID,
        allow_credentials=allowed_credentials,
    )

    challenge_hex = auth_options.challenge.hex()
    challenge_service.create_challenge(
        db=db, challenge=challenge_hex, customer_id=customer.customer_id,
        challenge_type=ChallengeType.FIDO2, expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    
    # --- POPULATE THE NEW `customerId` FIELD IN THE RESPONSE ---
    return FidoLoginStartResponse(
        challenge=bytes_to_base64url(auth_options.challenge),
        timeout=auth_options.timeout,
        rpId=auth_options.rp_id,
        allowCredentials=[
            { "type": cred['type'], "id": bytes_to_base64url(cred['id']) }
            for cred in allowed_credentials
        ],
        userVerification=auth_options.user_verification,
        user={
            "id": bytes_to_base64url(customer.customer_id.encode('utf-8')),
            "name": customer.email,
            "displayName": customer.name
        },
        customerId=customer.customer_id # Provide the plain ID
    )


@router.post("/fido/login/finish", summary="Finish FIDO2 login")
def finish_fido_login(
    http_request: Request,
    request: FidoLoginFinishRequest,
    db: Session = Depends(get_db),
):
    # --- THIS IS THE DEFINITIVE FIX ---
    # The `customer_id` from the request is the Base64URL encoded user handle.
    encoded_user_handle = request.customer_id
    
    try:
        # Decode it back into the raw UUID bytes, then into a string.
        decoded_customer_id_bytes = base64url_to_bytes(encoded_user_handle)
        print(decoded_customer_id_bytes)
        customer_id = decoded_customer_id_bytes.decode('utf-8')
        print(customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format.")
    # ------------------------------------

    customer = user_service.get_customer_by_id(db, customer_id=customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found for the provided ID.")
        
    try:
        credential_dict = json.loads(request.credential)
        response_dict = credential_dict['response']

        parsed_response = AuthenticatorAssertionResponse(
            client_data_json=base64url_to_bytes(response_dict['clientDataJSON']),
            authenticator_data=base64url_to_bytes(response_dict['authenticatorData']),
            signature=base64url_to_bytes(response_dict['signature']),
            user_handle=base64url_to_bytes(response_dict['userHandle']) if response_dict.get('userHandle') else None,
        )

        parsed_credential = AuthenticationCredential(
            id=credential_dict['id'],
            raw_id=base64url_to_bytes(credential_dict['rawId']),
            response=parsed_response,
            type=credential_dict['type'],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse incoming credential: {e}")
    
    client_data_str = parsed_credential.response.client_data_json.decode('utf-8')
    client_data_dict = json.loads(client_data_str)
    challenge_from_client_b64url = client_data_dict['challenge']
    challenge_hex = base64url_to_bytes(challenge_from_client_b64url).hex()
    
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=challenge_hex)
    if not db_challenge or db_challenge.customer_id != customer.customer_id:
        raise HTTPException(status_code=400, detail="Challenge is invalid.")

    passkey = user_service.get_passkey_by_credential_id(db, credential_id=parsed_credential.raw_id)
    if not passkey:
        raise HTTPException(status_code=404, detail="This security key is not registered for this user.")

    try:
        auth_verification = verify_authentication_response(
            credential=parsed_credential,
            expected_challenge=bytes.fromhex(db_challenge.challenge_string),
            expected_rp_id=settings.RP_ID,
            expected_origin=http_request.headers.get("origin"),
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
        user_service.update_passkey_sign_count(
            db=db,
            credential_id=auth_verification.credential_id,
            new_count=auth_verification.new_sign_count,
        )
        return {"status": "ok", "customer_id": customer.customer_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication verification failed: {e}")