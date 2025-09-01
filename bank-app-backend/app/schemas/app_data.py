# --- File: app/schemas/app_data.py ---
from pydantic import BaseModel
import uuid

class AppAccessRevokeRequest(BaseModel):
    customer_unique_id: uuid.UUID