# --- File: app/api/api_v1/endpoints/user_info.py ---

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import EmailStr

from app.db.base import get_db
from app.services import user_service

router = APIRouter()

@router.get("/users/fido-status/{email}", summary="Check if a user has registered FIDO devices")
def get_user_fido_status(email: EmailStr, db: Session = Depends(get_db)):
    """
    Checks if a user exists and if they have any passkeys (FIDO devices) registered.
    """
    customer = user_service.get_customer_by_email(db, email=email)
    
    if not customer:
        raise HTTPException(status_code=404, detail="User with this email not found.")

    has_fido_devices = len(customer.passkeys) > 0
    
    return {"hasFidoDevices": has_fido_devices, "customerId": customer.customer_id}