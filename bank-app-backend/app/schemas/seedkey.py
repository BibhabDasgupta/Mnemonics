# from pydantic import BaseModel
# from datetime import datetime
# from typing import Optional

# class SeedkeyBase(BaseModel):
#     public_key: str

# class SeedkeyCreate(SeedkeyBase):
#     pass

# class Seedkey(SeedkeyBase):
#     id: int
#     customer_id: str
#     is_revoked: bool
#     last_loggedInIP: Optional[str] = None
#     last_loggedInLocation: Optional[str] = None
#     last_loggedInTime: Optional[datetime] = None
#     no_of_logged_in_devices: int

#     class Config:
#         from_attributes = True


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