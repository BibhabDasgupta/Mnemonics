from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.schemas.login_schema import UserNameRequest, UserNameResponse
from app.services.otp_service import encrypt_data
from sqlalchemy.sql import text

router = APIRouter()

@router.post("/user/name", response_model=UserNameResponse)
async def get_user_name(request: UserNameRequest, db: Session = Depends(get_db)):
    try:
        query = text("SELECT name FROM app_data WHERE customer_id = :customer_id")
        result = db.execute(query, {"customer_id": request.customer_id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        return {"name": result.name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user name: {str(e)}")