# --- File: app/schemas/seedkey.py ---
from pydantic import BaseModel
from datetime import datetime

class SeedkeyBase(BaseModel):
    public_key: str
    user_id: str

class SeedkeyCreate(SeedkeyBase):
    pass

class Seedkey(SeedkeyBase):
    id: int
    customer_id: str
    created_at: datetime

    class Config:
        from_attributes = True