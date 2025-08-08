from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models.behavior import UserBehavior
from app.schemas.behavior import BehaviorDataCreate, BehaviorDataResponse

router = APIRouter()

@router.post("/analytics/behavior", response_model=BehaviorDataResponse, status_code=201)
def log_behavioral_data(
    *,
    db: Session = Depends(get_db),
    behavior_in: BehaviorDataCreate
):
    """
    Receives behavioral data from the frontend, validates it,
    and logs it to the database.
    """
    # Create a new UserBehavior record from the validated input data
    behavior_obj = UserBehavior(
        flight_avg=behavior_in.flight_avg,
        traj_avg=behavior_in.traj_avg,
        typing_speed=behavior_in.typing_speed,
        correction_rate=behavior_in.correction_rate,
        clicks_per_minute=behavior_in.clicks_per_minute,
        # --- MODIFIED: Use the customer_unique_id from the payload ---
        customer_unique_id=behavior_in.customer_unique_id 
    )
    
    db.add(behavior_obj)
    db.commit()
    db.refresh(behavior_obj)
    
    return behavior_obj
