# --- File: app/schemas/transactions.py ---

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TransactionCreateRequest(BaseModel):
    recipient_account_number: str = Field(..., description="The account number of the recipient.")
    amount: float = Field(..., gt=0, description="The amount to transfer.")
    terminal_id: str = Field(..., description="A unique identifier for the client device/terminal.")
    biometric_hash: str = Field(..., description="A hash representing the client's biometric state.")
    is_reauth_transaction: Optional[bool] = Field(False, description="Whether this is a re-authenticated transaction after fraud detection.")
    original_fraud_alert_id: Optional[str] = Field(None, description="ID of the original fraud alert that was bypassed.")
    # NEW: PIN verification for re-authentication
    atm_pin: Optional[str] = Field(None, description="ATM PIN for re-authentication (required for blocked transactions)")
    pin_verified: Optional[bool] = Field(False, description="Whether PIN verification was completed")

# NEW: PIN verification request schema
class PinVerificationRequest(BaseModel):
    atm_pin: str = Field(..., min_length=4, max_length=6, description="ATM PIN (4-6 digits)")
    original_fraud_alert_id: Optional[str] = Field(None, description="Original fraud alert ID")

class PinVerificationResponse(BaseModel):
    verified: bool = Field(..., description="Whether PIN verification was successful")
    message: str = Field(..., description="Verification result message")
    attempts_remaining: Optional[int] = Field(None, description="Remaining PIN attempts before lockout")
    locked_until: Optional[datetime] = Field(None, description="PIN lockout expiration time")

# NEW: Re-authentication request schema (PIN + FIDO2)
class ReauthTransactionRequest(BaseModel):
    transaction_data: dict = Field(..., description="Original transaction data")
    atm_pin: str = Field(..., min_length=4, max_length=6, description="ATM PIN for verification")
    original_fraud_alert_id: Optional[str] = Field(None, description="Original fraud alert ID")

class TransactionResponse(BaseModel):
    status: str
    new_balance: Optional[float] = None
    fraud_prediction: bool = False
    fraud_probability: Optional[float] = None
    fraud_details: Optional[dict] = None
    blocked: bool = False
    is_reauth_transaction: bool = False
    pin_verified: bool = False
    auth_method: Optional[str] = None
    fraud_detection_bypassed: bool = False

    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    account_id: int
    description: str
    amount: float
    type: str

class TransactionInDB(TransactionCreate):
    id: int
    date: datetime

    class Config:
        from_attributes = True