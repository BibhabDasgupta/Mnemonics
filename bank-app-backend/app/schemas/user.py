# --- File: app/schemas/user.py ---
# from pydantic import BaseModel, EmailStr
# from typing import List, Dict, Any, Optional
# from datetime import datetime, date
# from .passkey import PasskeyInDB
# from .seedkey import Seedkey

# class CustomerBase(BaseModel):
#     encrypted_customer_id: str
#     encrypted_name: str
#     encrypted_email: str
#     encrypted_phone_number: Optional[str] = None
#     encrypted_aadhaar_number: str
#     encrypted_date_of_birth: Optional[str] = None
#     is_registered_in_app: Optional[bool] = False
#     last_sim_data: Optional[Dict[str, Any]] = None
#     last_phone_data: Optional[Dict[str, Any]] = None
#     other_details: Optional[List[dict]] = []

# class CustomerCreate(CustomerBase):
#     pass

# class CustomerInDB(CustomerBase):
#     id: int
#     created_at: datetime
#     passkeys: List[PasskeyInDB] = []
#     seedkey: Optional[Seedkey] = None

#     class Config:
#         from_attributes = True

# class Customer(CustomerBase):
#     id: int
#     created_at: datetime

#     class Config:
#         from_attributes = True

# class AppDataBase(BaseModel):
#     email: EmailStr
#     name: str
#     phone_number: Optional[str] = None
#     aadhaar_number: str
#     date_of_birth: Optional[date] = None
#     app_access_revoked: bool = False
#     last_logged_in_ip: Optional[str] = None
#     last_logged_in_location: Optional[str] = None
#     last_logged_in_time: Optional[datetime] = None
#     other_details: Optional[List[dict]] = []
#     no_of_logged_in_devices: int = 0

# class AppDataCreate(AppDataBase):
#     last_sim_data: Optional[Dict[str, Any]] = None
#     last_phone_data: Optional[Dict[str, Any]] = None

# class AppDataInDB(AppDataBase):
#     id: int
#     customer_id: str
#     created_at: datetime
#     updated_at: datetime
#     passkeys: List[PasskeyInDB] = []
#     seedkey: Optional[Seedkey] = None

#     class Config:
#         from_attributes = True

# class AppData(AppDataBase):
#     id: int
#     customer_id: str
#     created_at: datetime
#     updated_at: datetime

#     class Config:
#         from_attributes = True

# class SeedkeyRegistrationRequest(BaseModel):
#     app_data: AppDataCreate
#     public_key: str
#     user_id: str

# class TransactionBase(BaseModel):
#     account_id: int
#     description: str
#     amount: float
#     type: str

# class TransactionCreate(TransactionBase):
#     pass

# class TransactionInDB(TransactionBase):
#     id: int
#     date: datetime

#     class Config:
#         from_attributes = True

# class AppAccessRevokeRequest(BaseModel):
#     customer_id: str
#     app_access_revoked: bool

# class PhoneVerificationRequest(BaseModel):
#     encrypted_phone_number: str  # Removed ephemeral_public_key

# class OTPVerificationRequest(BaseModel):
#     encrypted_phone_number: str
#     otp_code: str
    

# class FidoLoginStartRequest(BaseModel):
#     customer_id: str

# class FidoLoginFinishRequest(BaseModel):
#     customer_id: str
#     credential: dict

# class SeedkeyVerificationRequest(BaseModel):
#     customer_id: str
#     challenge: str
#     public_key: str

# UserCreate = CustomerCreate
# UserResponse = Customer


# class LoginFailureNotificationRequest(BaseModel):
#     customer_id: str
#     failure_reason: str

# class LoginFailureNotificationResponse(BaseModel):
#     status: str
#     attempts_remaining: Optional[int] = None
#     lockout_info: Optional[Dict[str, Any]] = None
#     message: str

# class LoginStatusResponse(BaseModel):
#     is_locked: bool
#     failed_attempts: int
#     attempts_remaining: int
#     locked_until: Optional[str] = None
#     time_remaining_hours: float


# class LogoutRequest(BaseModel):
#     customer_id: str









# Enhanced schemas with new fields for device tracking and attempt management
from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, date

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
    # Enhanced fields for restoration limits
    is_restoration_limited: bool = False
    restoration_daily_limit: float = 5000.00
    restoration_limit_expires_at: Optional[datetime] = None
    # Enhanced fields for attempt tracking
    failed_login_attempts: int = 0
    login_blocked_until: Optional[datetime] = None
    seedkey_failed_attempts: int = 0
    seedkey_blocked_until: Optional[datetime] = None

class AppDataCreate(AppDataBase):
    last_sim_data: Optional[Dict[str, Any]] = None
    last_phone_data: Optional[Dict[str, Any]] = None

class AppDataInDB(AppDataBase):
    id: int
    customer_id: str
    created_at: datetime
    updated_at: datetime

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
    recipient_name: Optional[str] = None  # Enhanced for SMS notifications

class TransactionCreate(TransactionBase):
    pass

class TransactionInDB(TransactionBase):
    id: int
    date: datetime
    is_fraud: bool = False
    is_reauth_transaction: bool = False
    auth_method: Optional[str] = None

    class Config:
        from_attributes = True

class AppAccessRevokeRequest(BaseModel):
    customer_unique_id: str

class PhoneVerificationRequest(BaseModel):
    encrypted_phone_number: str

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
    public_key: str

class LoginFailureNotificationRequest(BaseModel):
    customer_id: str
    failure_reason: str

class LoginFailureNotificationResponse(BaseModel):
    status: str
    attempts_remaining: Optional[int] = None
    lockout_info: Optional[Dict[str, Any]] = None
    message: str

class LoginStatusResponse(BaseModel):
    is_locked: bool
    failed_attempts: int
    attempts_remaining: int
    locked_until: Optional[str] = None
    time_remaining_hours: float

class LogoutRequest(BaseModel):
    customer_id: str

# New schemas for enhanced features
class DeviceHistoryEntry(BaseModel):
    action_type: str
    timestamp: str
    device_info: str
    location: str
    ip_address: str
    user_agent: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None

class DeviceHistoryResponse(BaseModel):
    status: str
    customer_id: str
    device_history: List[DeviceHistoryEntry]
    total_entries: int

class ActivityStatsResponse(BaseModel):
    status: str
    customer_id: str
    registrations: int
    restorations: int
    successful_logins: int
    latest_login: Optional[DeviceHistoryEntry] = None
    latest_registration: Optional[DeviceHistoryEntry] = None
    latest_restoration: Optional[DeviceHistoryEntry] = None
    is_restoration_limited: bool
    logged_in_devices: int

class SecuritySummaryResponse(BaseModel):
    status: str
    customer_id: str
    name: str
    app_access_revoked: bool
    no_of_logged_in_devices: int
    last_logged_in_time: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    is_restoration_limited: bool
    restoration_limit_expires_at: Optional[str] = None
    activity_counts: Dict[str, int]
    latest_activities: Dict[str, Optional[DeviceHistoryEntry]]
    recent_device_history: List[DeviceHistoryEntry]
    failed_login_attempts: int
    seedkey_failed_attempts: int

class SeedkeyLockoutInfo(BaseModel):
    is_locked: bool
    failed_attempts: int
    attempts_remaining: int
    locked_until: Optional[str] = None
    time_remaining_hours: float
    lockout_duration_hours: int = 24

class SeedkeyAttemptRequest(BaseModel):
    customer_id: str
    success: bool
    device_info: str
    location: str
    failure_reason: Optional[str] = None

class TransactionNotificationRequest(BaseModel):
    customer_id: str
    amount: float
    recipient_account: str
    recipient_name: str
    new_balance: float
    transaction_id: Optional[str] = None
    device_info: Optional[str] = None
    location: Optional[str] = None

class RegistrationNotificationRequest(BaseModel):
    customer_id: str
    device_info: str
    location: str
    ip_address: str

class RestorationNotificationRequest(BaseModel):
    customer_id: str
    device_info: str
    location: str
    ip_address: str
    restoration_limits_info: Optional[Dict[str, Any]] = None

class RevocationNotificationRequest(BaseModel):
    customer_id: str
    device_info: str
    location: str

class AnomalyDetectionNotificationRequest(BaseModel):
    customer_id: str
    anomaly_type: str
    details: str
    device_info: Optional[str] = None
    location: Optional[str] = None

class SMSNotificationResponse(BaseModel):
    status: str
    message: str
    sms_sent: bool

# Enhanced transaction schemas
class EnhancedTransactionCreateRequest(BaseModel):
    recipient_account_number: str
    amount: float
    terminal_id: str
    biometric_hash: str
    account_number: str
    recipient_name: Optional[str] = None  # For SMS notifications
    is_reauth_transaction: Optional[bool] = False
    pin_verified: Optional[bool] = False
    original_fraud_alert_id: Optional[str] = None

class TransactionResponse(BaseModel):
    status: str
    new_balance: Optional[float] = None
    transaction_id: Optional[str] = None
    fraud_prediction: bool = False
    fraud_probability: Optional[float] = None
    fraud_details: Optional[Dict[str, Any]] = None
    blocked: bool = False
    is_reauth_transaction: bool = False
    pin_verified: bool = False
    original_fraud_alert_id: Optional[str] = None
    fraud_detection_bypassed: bool = False
    auth_method: Optional[str] = None
    message: str
    restoration_info: Optional[Dict[str, Any]] = None
    security_notice: Optional[str] = None



class MnemonicAttemptRequest(BaseModel):
    customerId: str
    success: bool
    failureReason: Optional[str] = None
    deviceInfo: Dict[str, str]

# Keep existing schemas for backward compatibility
UserCreate = CustomerCreate
UserResponse = Customer