from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db.models.user import AppData
import uuid

def revoke_app_access(db: Session, customer_unique_id: uuid.UUID) -> AppData:
    """
    Finds a customer's AppData record by their unique ID and sets
    the app_access_revoked flag to True.
    """
    app_data_entry = db.query(AppData).filter(AppData.customer_id == str(customer_unique_id)).first()

    if not app_data_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer application data not found."
        )

    app_data_entry.app_access_revoked = True
    db.commit()
    db.refresh(app_data_entry)
    
    return app_data_entry