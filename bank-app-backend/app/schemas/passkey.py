from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime

class PasskeyInDB(BaseModel):
    id: int
    credential_id: bytes
    sign_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class WebAuthnLoginRequest(BaseModel):
    customer_id: str

class WebAuthnRegistrationResponse(BaseModel):
    id: str
    rawId: str
    response: Dict[str, Any]
    type: str

class WebAuthnAuthenticationResponse(WebAuthnRegistrationResponse):
    pass