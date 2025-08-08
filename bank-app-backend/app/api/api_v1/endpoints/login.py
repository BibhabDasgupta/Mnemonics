from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import EmailStr
from datetime import datetime, timedelta
import jwt
from app.db.base import get_db
from app.services import fido_seedkey_service
from app.schemas.user import FidoLoginStartRequest, FidoLoginFinishRequest, SeedkeyVerificationRequest
from app.core.config import settings

router = APIRouter()

@router.post("/login/fido-start")
def start_fido_login(request: FidoLoginStartRequest, db: Session = Depends(get_db)):
    """
    Start FIDO2 login by generating authentication options and a challenge.
    """
    try:
        return fido_seedkey_service.start_fido_login(db, request.customer_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FIDO login start failed: {str(e)}")



@router.post("/login/fido-finish")
def finish_fido_login(
    http_request: Request,
    request: FidoLoginFinishRequest,
    db: Session = Depends(get_db)
):
    """
    Finish FIDO2 login, verify the credential, and initiate seed key challenge.
    """
    try:
        result = fido_seedkey_service.finish_fido_login(db, http_request, request.customer_id, request.credential)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FIDO login finish failed: {str(e)}")

        

@router.post("/login/seedkey-verify")
def verify_seedkey(
    request: SeedkeyVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Verify the seed key signature, issue a JWT, and update login metadata.
    """
    try:
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

        return {
            "status": "login_success",
            "token": token,
            "customer_id": request.customer_id
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed key verification failed: {str(e)}")