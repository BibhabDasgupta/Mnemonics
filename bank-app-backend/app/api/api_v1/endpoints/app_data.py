# --- File: app/api/api_v1/endpoints/app_data.py ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.schemas.app_data import AppAccessRevokeRequest
from app.services import app_data_service

router = APIRouter()

@router.post("/appdata/revoke", status_code=200)
def revoke_customer_access(
    request: AppAccessRevokeRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint to revoke a customer's access to the application.
    """
    try:
        app_data_service.revoke_app_access(db, customer_unique_id=request.customer_unique_id)
        return {"status": "success", "message": "Customer access has been revoked."}
    except HTTPException as e:
        raise e
    except Exception as e:
        # Catch any other unexpected errors
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

