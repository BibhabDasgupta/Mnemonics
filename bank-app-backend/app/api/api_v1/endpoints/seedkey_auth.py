from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import secrets
from datetime import datetime, timedelta

from app.db.base import get_db
from app.schemas.user import SeedkeyRegistrationRequest, Customer as CustomerSchema
from app.services import user_service, challenge_service, account_service
from app.core.security import verify_signature
from app.db.models.challenge import ChallengeType

router = APIRouter()

# Define the Pydantic models used by the endpoints at the top.
class ChallengeRequest(BaseModel):
    customer_id: str

class ChallengeResponse(BaseModel):
    customer_id: str
    public_key: str
    signature: str
    challenge: str

#
# Endpoint for New User Registration
#
@router.post("/register/seedkey", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
def register_with_seedkey(
    request: SeedkeyRegistrationRequest,
    db: Session = Depends(get_db)
):
    """
    Handles new user registration by creating a Customer and Seedkey record,
    and then creating a default bank account for them.
    """
    customer_in = request.customer
    
    # Check for duplicate users before creation
    if user_service.get_customer_by_email(db, email=customer_in.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    if user_service.get_customer_by_aadhaar(db, aadhaar=customer_in.aadhaar_number):
        raise HTTPException(status_code=409, detail="Aadhaar number already registered")

    # Create the user in the database
    customer = user_service.create_customer_with_seedkey(
        db=db,
        customer_in=customer_in,
        public_key=request.public_key
    )

    # Automatically create a default bank account
    if customer:
        account_service.create_account_for_customer(db, customer_id=customer.customer_id)

    return customer


#
# Secure Challenge-Response Endpoints for Seed Key Login
#

@router.post("/login/seedkey/start", summary="Step 1: Start seed key verification by generating a challenge")
def start_seedkey_verification(request: ChallengeRequest, db: Session = Depends(get_db)):
    """
    Generates a unique, single-use challenge for a user, saves it to the database
    with a 5-minute expiry, and returns it to the client.
    """
    challenge_service.delete_expired_challenges(db)
    
    challenge = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    challenge_service.create_challenge(
        db=db,
        challenge=challenge,
        customer_id=request.customer_id,
        challenge_type=ChallengeType.SEEDKEY,
        expires_at=expires_at
    )
    
    return {"challenge": challenge}


@router.post("/login/seedkey/finish", response_model=CustomerSchema, summary="Step 2: Finish seed key verification with a signed challenge")
def finish_seedkey_verification(
    request: ChallengeResponse,
    db: Session = Depends(get_db)
):
    """
    Verifies a signed challenge against the record in the database. This is the
    second factor of the 2FA login flow.
    """
    customer = user_service.get_customer_by_id(db, customer_id=request.customer_id)
    if not customer or not customer.seedkey:
        raise HTTPException(status_code=404, detail="User or seed key not found.")

    # Retrieve and immediately delete the challenge to prevent reuse
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=request.challenge)
    if not db_challenge or db_challenge.customer_id != request.customer_id or db_challenge.challenge_type != ChallengeType.SEEDKEY:
        raise HTTPException(status_code=400, detail="Challenge is invalid, expired, or of the wrong type.")

    # Verify the public key from the request matches the one in the database
    if customer.seedkey.public_key != request.public_key:
        raise HTTPException(status_code=401, detail="Public key mismatch.")

    # Perform the cryptographic signature verification
    is_valid = verify_signature(
        public_key_hex=request.public_key,
        signature_hex=request.signature,
        message=request.challenge
    )

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid signature. Login failed.")

    # If successful, update login metadata and return the user object
    updated_customer = user_service.update_customer_login_meta(db, customer_id=customer.customer_id)
    return updated_customer

@router.post("/verify/identity", response_model=CustomerSchema, summary="Verify user identity with seed key before first FIDO registration")
def verify_user_identity_with_seedkey(
    request: ChallengeResponse, # Reuse the same secure response model
    db: Session = Depends(get_db)
):
    """
    Used for the first-time login flow. Verifies a user's seed key via challenge-response
    and confirms they have no existing FIDO devices.
    """
    customer = user_service.get_customer_by_id(db, customer_id=request.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="User not found.")

    if customer.passkeys:
        raise HTTPException(status_code=409, detail="User already has a registered device. Please use the standard login flow.")
    
    # Verify the seed key signature (reusing the secure logic from the main login)
    db_challenge = challenge_service.get_and_delete_challenge(db, challenge=request.challenge)
    if not db_challenge or db_challenge.customer_id != request.customer_id or db_challenge.challenge_type != ChallengeType.SEEDKEY:
        raise HTTPException(status_code=400, detail="Challenge is invalid, expired, or of the wrong type.")

    if not customer.seedkey or customer.seedkey.public_key != request.public_key:
        raise HTTPException(status_code=401, detail="Public key mismatch.")

    is_valid = verify_signature(
        public_key_hex=request.public_key,
        signature_hex=request.signature,
        message=request.challenge
    )

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid signature. Identity verification failed.")

    # On success, return the customer data so the frontend can proceed to FIDO registration
    return customer