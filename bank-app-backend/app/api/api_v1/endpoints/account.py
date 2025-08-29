# --- File: app/api/api_v1/endpoints/account.py ---

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime, timezone
import logging

from app.db.base import get_db
from app.db.models.user import Account, AppData
from app.services.pin_verification_service import PinVerificationService
from app.services.restoration_limit_service import RestorationLimitService
from app.api.api_v1.endpoints.transactions import get_current_customer

router = APIRouter()
logger = logging.getLogger(__name__)

class PinSetupRequest(BaseModel):
    new_pin: str = Field(..., min_length=4, max_length=6, description="New ATM PIN (4-6 digits)")

class PinSetupResponse(BaseModel):
    success: bool = Field(..., description="Whether PIN setup was successful")
    message: str = Field(..., description="Setup result message")

class RestorationStatusResponse(BaseModel):
    is_limited: bool
    limit_amount: Optional[float] = None
    daily_used: Optional[float] = None
    remaining_limit: Optional[float] = None
    hours_remaining: Optional[float] = None
    expires_at: Optional[str] = None
    message: str

class ActivateRestorationLimitsRequest(BaseModel):
    custom_limit: Optional[float] = Field(None, description="Custom limit amount (defaults to 5000 INR)")

@router.post("/account/set-pin", response_model=PinSetupResponse)
def set_atm_pin(
    request: PinSetupRequest,
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Set or update ATM PIN for the authenticated customer
    """
    try:
        logger.info(f"PIN setup requested for customer: {current_customer.customer_id}")
        
        # Validate PIN format
        if not request.new_pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN must contain only numbers")
        
        if not (4 <= len(request.new_pin) <= 6):
            raise HTTPException(status_code=400, detail="PIN must be 4-6 digits long")
        
        # Use PIN verification service to set PIN
        success = PinVerificationService.set_pin(
            db=db,
            customer_id=current_customer.customer_id,
            new_pin=request.new_pin
        )
        
        if success:
            logger.info(f"PIN set successfully for customer: {current_customer.customer_id}")
            return PinSetupResponse(
                success=True,
                message="ATM PIN has been set successfully"
            )
        else:
            logger.error(f"Failed to set PIN for customer: {current_customer.customer_id}")
            raise HTTPException(status_code=500, detail="Failed to set PIN")
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.exception(f"PIN setup error for customer {current_customer.customer_id}: {e}")
        raise HTTPException(status_code=500, detail="PIN setup service temporarily unavailable")

@router.get("/account/pin-status")
def get_pin_status(
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Check if customer has PIN set and lockout status
    """
    try:
        account = db.query(Account).filter(Account.customer_id == current_customer.customer_id).first()
        
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        return {
            "has_pin": bool(account.atm_pin_hash),
            "pin_attempts": account.pin_attempts,
            "is_locked": PinVerificationService._is_pin_locked(account),
            "locked_until": account.pin_locked_until.isoformat() if account.pin_locked_until else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"PIN status check error for customer {current_customer.customer_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to check PIN status")

@router.post("/account/reset-pin-attempts")
def reset_pin_attempts(
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Reset PIN attempts (for customer service or admin use)
    Note: In production, this should require additional authentication
    """
    try:
        success = PinVerificationService.reset_pin_attempts(
            db=db,
            customer_id=current_customer.customer_id
        )
        
        if success:
            logger.info(f"PIN attempts reset for customer: {current_customer.customer_id}")
            return {"success": True, "message": "PIN attempts have been reset"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reset PIN attempts")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"PIN reset error for customer {current_customer.customer_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to reset PIN attempts")

# ===== RESTORATION LIMIT ENDPOINTS (FIXED TO USE AppData) =====

@router.get("/account/restoration-status", response_model=RestorationStatusResponse)
def get_restoration_status(
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Get current restoration limit status for the authenticated customer
    """
    try:
        logger.info(f"Restoration status check for customer: {current_customer.customer_id}")
        
        restoration_info = RestorationLimitService.get_restoration_info(
            db=db,
            customer_id=current_customer.customer_id
        )
        
        return RestorationStatusResponse(**restoration_info)
        
    except Exception as e:
        logger.exception(f"Error checking restoration status for {current_customer.customer_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to check restoration status")

@router.post("/account/activate-restoration-limits")
def activate_restoration_limits(
    request: ActivateRestorationLimitsRequest,
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Manually activate restoration limits (for testing or admin use)
    Note: In production, this should require additional authentication
    """
    try:
        custom_limit = Decimal(str(request.custom_limit)) if request.custom_limit else None
        
        success = RestorationLimitService.activate_restoration_limits(
            db=db,
            customer_id=current_customer.customer_id,
            limit_amount=custom_limit
        )
        
        if success:
            logger.info(f"Restoration limits manually activated for customer: {current_customer.customer_id}")
            return {
                "success": True,
                "message": f"Restoration limits activated. Limit: ₹{custom_limit or 5000} for 35 hours"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to activate restoration limits")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error activating restoration limits for {current_customer.customer_id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to activate restoration limits")

@router.post("/account/remove-restoration-limits")
def remove_restoration_limits(
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Remove active restoration limits (admin function)
    Note: In production, this should require admin authentication
    """
    try:
        # FIXED: Use AppData instead of Account for restoration data
        app_data = db.query(AppData).filter(AppData.customer_id == current_customer.customer_id).first()
        
        if not app_data:
            raise HTTPException(status_code=404, detail="App data not found")
        
        if not app_data.is_restoration_limited:
            return {"success": True, "message": "No restoration limits were active"}
        
        app_data.is_restoration_limited = False
        app_data.restoration_limit_expires_at = None
        app_data.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"Restoration limits manually removed for customer: {current_customer.customer_id}")
        return {"success": True, "message": "Restoration limits have been removed"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error removing restoration limits for {current_customer.customer_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to remove restoration limits")