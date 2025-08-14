# --- File: app/schemas/transaction.py ---

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TransactionResponse(BaseModel):
    status: str
    new_balance: float
    fraud_prediction: bool
    fraud_probability: Optional[float] = None
    fraud_details: Optional[dict] = None  # Add this
    
    class Config:
        from_attributes = True
        
class TransactionCreateRequest(BaseModel):
    recipient_account_number: str = Field(..., description="The account number of the recipient.")
    amount: float = Field(..., gt=0, description="The amount to transfer.")
    terminal_id: str = Field(..., description="A unique identifier for the client device/terminal.")
    biometric_hash: str = Field(..., description="A hash representing the client's biometric state.")
    is_reauth_transaction: Optional[bool] = Field(False, description="Whether this is a re-authenticated transaction after fraud detection.")
    original_fraud_alert_id: Optional[str] = Field(None, description="ID of the original fraud alert that was bypassed.")
    
class TransactionCreate(BaseModel):
    account_id: int
    description: str
    amount: float
    type: str

class TransactionResponse(TransactionCreate):
    id: int
    date: datetime
    
    class Config:
        from_attributes = True

class TransactionInDB(TransactionCreate):
    id: int
    date: datetime

    class Config:
        from_attributes = True