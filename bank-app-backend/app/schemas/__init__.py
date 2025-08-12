# --- File: bank-app-backend/app/schemas/__init__.py ---
from .behavior import BehaviorDataCreate, BehaviorDataResponse
from .user import (
    CustomerCreate, 
    Customer, 
    AppDataCreate, 
    AppData,
    SeedkeyRegistrationRequest,
    PhoneVerificationRequest,
    OTPVerificationRequest,
    FidoLoginStartRequest,
    FidoLoginFinishRequest,
    SeedkeyVerificationRequest,
    AppAccessRevokeRequest
)
from .transaction import (
    TransactionCreate, 
    TransactionResponse, 
    TransactionCreateRequest,
    TransactionInDB
)
from .ml_behavior import (
    MLBehaviorRequest,
    MLTrainingRequest, 
    MLBehaviorResponse,
    MLTrainingResponse,
    MLModelInfoResponse,
    AutoTrainRequest,
    AutoTrainResponse
)

__all__ = [
    "BehaviorDataCreate",
    "BehaviorDataResponse", 
    "CustomerCreate",
    "Customer",
    "AppDataCreate",
    "AppData",
    "SeedkeyRegistrationRequest",
    "PhoneVerificationRequest", 
    "OTPVerificationRequest",
    "FidoLoginStartRequest",
    "FidoLoginFinishRequest",
    "SeedkeyVerificationRequest",
    "AppAccessRevokeRequest",
    "TransactionCreate",
    "TransactionResponse",
    "TransactionCreateRequest",
    "TransactionInDB",
    "MLBehaviorRequest",
    "MLTrainingRequest",
    "MLBehaviorResponse", 
    "MLTrainingResponse",
    "MLModelInfoResponse",
    "AutoTrainRequest",
    "AutoTrainResponse"
]