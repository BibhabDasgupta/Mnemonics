# --- File: app/schemas/transaction.py ---

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TransactionCreateRequest(BaseModel):
    recipient_account_number: str = Field(..., description="The account number of the recipient.")
    amount: float = Field(..., gt=0, description="The amount to transfer.")
    terminal_id: str = Field(..., description="A unique identifier for the client device/terminal.")
    biometric_hash: str = Field(..., description="A hash representing the client's biometric state.")

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