# --- File: bank-app-frontend/app/schemas/behavior.py ---
from pydantic import BaseModel, Field
from typing import Optional
import uuid

class BehaviorDataCreate(BaseModel):
    """
    Schema for validating the incoming payload from the frontend.
    This structure must match the `Payload` interface in the frontend provider.
    """
    flight_avg: float
    traj_avg: float
    typing_speed: float
    correction_rate: float
    clicks_per_minute: float
    # --- MODIFIED: Renamed to customer_unique_id and made it a required field ---
    # The frontend should pass the UUID of the logged-in user.
    customer_unique_id: uuid.UUID

class BehaviorDataResponse(BehaviorDataCreate):
    """Schema for the data returned in the API response."""
    id: int
    session_id: str
    
    class Config:
        from_attributes = True # Formerly orm_mode = True