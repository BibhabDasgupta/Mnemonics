from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any

class RPModel(BaseModel):
    id: str
    name: str

class UserModel(BaseModel):
    id: str
    name: str
    display_name: str = Field(alias="displayName")

class CredentialDescriptorModel(BaseModel):
    type: str
    id: str

class PubKeyCredParamModel(BaseModel):
    type: str
    alg: int

class AuthenticatorSelectionModel(BaseModel):
    authenticator_attachment: Optional[str] = Field(None, alias="authenticatorAttachment")
    require_resident_key: bool = Field(alias="requireResidentKey")
    resident_key: Optional[str] = Field(None, alias="residentKey")
    user_verification: str = Field(alias="userVerification")

class FidoRegisterStartRequest(BaseModel):
    customer_id: str

class FidoRegisterFinishRequest(BaseModel):
    customer_id: str
    credential: str

class FidoRegisterStartResponse(BaseModel):
    rp: RPModel
    user: UserModel
    challenge: str
    pub_key_cred_params: List[PubKeyCredParamModel] = Field(alias="pubKeyCredParams")
    timeout: int
    exclude_credentials: List[CredentialDescriptorModel] = Field(alias="excludeCredentials")
    authenticator_selection: AuthenticatorSelectionModel = Field(alias="authenticatorSelection")
    attestation: str

class FidoLoginStartRequest(BaseModel):
    customer_id: str

class FidoLoginFinishRequest(BaseModel):
    customer_id: str
    credential: Dict[str, Any]

class FidoLoginStartResponse(BaseModel):
    challenge: str
    timeout: int
    rp_id: str = Field(alias="rpId")
    allow_credentials: List[Dict[str, str]] = Field(alias="allowCredentials")
    user_verification: str = Field(alias="userVerification")
    user: UserModel
    customer_id: str = Field(alias="customerId")

class ChallengeRequest(BaseModel):
    customer_id: str

class ChallengeResponse(BaseModel):
    customer_id: str
    public_key: str
    signature: str
    challenge: str