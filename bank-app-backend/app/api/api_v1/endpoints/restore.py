from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.user import AppData
from pydantic import BaseModel
from sqlalchemy.sql import text

router = APIRouter()

class RestoreRequest(BaseModel):
    customer_id: str
    email: str
    aadhaar_number: str

@router.post("/restore")
def restore_user(request: RestoreRequest, db: Session = Depends(get_db)):
    query = text("SELECT customer_id, email, aadhaar_number FROM accounts WHERE customer_id = :customer_id")
    result = db.execute(query, {"customer_id": request.customer_id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Customer ID not found in accounts table")

    if result.email != request.email or result.aadhaar_number != request.aadhaar_number:
        raise HTTPException(status_code=400, detail="Invalid email or Aadhaar number")

    app_data = db.query(AppData).filter(AppData.customer_id == request.customer_id).first()
    if not app_data:
        raise HTTPException(status_code=404, detail="App data not found for this customer")

    if not app_data.app_access_revoked:
        raise HTTPException(status_code=400, detail="Account is not revoked")

    app_data.app_access_revoked = False
    db.commit()
    return {"status": "Account restored successfully"}