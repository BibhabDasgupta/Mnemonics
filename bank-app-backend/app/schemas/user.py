from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from .passkey import PasskeyInDB
from .seedkey import Seedkey

class CustomerBase(BaseModel):
    encrypted_customer_id: str
    encrypted_name: str
    encrypted_email: str
    encrypted_phone_number: Optional[str] = None
    encrypted_aadhaar_number: str
    encrypted_date_of_birth: Optional[str] = None
    is_registered_in_app: Optional[bool] = False
    last_sim_data: Optional[Dict[str, Any]] = None
    last_phone_data: Optional[Dict[str, Any]] = None
    other_details: Optional[List[dict]] = []

class CustomerCreate(CustomerBase):
    pass

class CustomerInDB(CustomerBase):
    id: int
    created_at: datetime
    passkeys: List[PasskeyInDB] = []
    seedkey: Optional[Seedkey] = None

    class Config:
        from_attributes = True

class Customer(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AppDataBase(BaseModel):
    email: EmailStr
    name: str
    phone_number: Optional[str] = None
    aadhaar_number: str
    date_of_birth: Optional[date] = None
    app_access_revoked: bool = False
    last_logged_in_ip: Optional[str] = None
    last_logged_in_location: Optional[str] = None
    last_logged_in_time: Optional[datetime] = None
    other_details: Optional[List[dict]] = []
    no_of_logged_in_devices: int = 0

class AppDataCreate(AppDataBase):
    last_sim_data: Optional[Dict[str, Any]] = None
    last_phone_data: Optional[Dict[str, Any]] = None

class AppDataInDB(AppDataBase):
    id: int
    customer_id: str
    created_at: datetime
    updated_at: datetime
    passkeys: List[PasskeyInDB] = []
    seedkey: Optional[Seedkey] = None

    class Config:
        from_attributes = True

class AppData(AppDataBase):
    id: int
    customer_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SeedkeyRegistrationRequest(BaseModel):
    app_data: AppDataCreate
    public_key: str
    user_id: str

class TransactionBase(BaseModel):
    account_id: int
    description: str
    amount: float
    type: str

class TransactionCreate(TransactionBase):
    pass

class TransactionInDB(TransactionBase):
    id: int
    date: datetime

    class Config:
        from_attributes = True

class AppAccessRevokeRequest(BaseModel):
    customer_id: str
    app_access_revoked: bool

class PhoneVerificationRequest(BaseModel):
    encrypted_phone_number: str  # Removed ephemeral_public_key

class OTPVerificationRequest(BaseModel):
    encrypted_phone_number: str
    otp_code: str
    

class FidoLoginStartRequest(BaseModel):
    customer_id: str

class FidoLoginFinishRequest(BaseModel):
    customer_id: str
    credential: dict

class SeedkeyVerificationRequest(BaseModel):
    customer_id: str
    challenge: str
    signature: str