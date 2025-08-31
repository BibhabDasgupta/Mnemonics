# --- File: bank-app-frontend/app/schemas/ml_behavior.py ---
from pydantic import BaseModel, Field
from typing import Dict, Optional
import uuid

class MLBehaviorRequest(BaseModel):
    """Request model for ML behavior analysis."""
    customer_unique_id: uuid.UUID
    flight_avg: float = Field(..., ge=0, description="Average flight time between keystrokes")
    traj_avg: float = Field(..., ge=0, description="Average mouse trajectory distance")
    typing_speed: float = Field(..., ge=0, description="Typing speed in characters per minute")
    correction_rate: float = Field(..., ge=0, description="Correction rate per minute")
    clicks_per_minute: float = Field(..., ge=0, description="Clicks per minute")

class MLTrainingRequest(BaseModel):
    """Request model for ML model training."""
    customer_unique_id: uuid.UUID
    force_retrain: bool = Field(default=False, description="Force model retraining")

class MLBehaviorResponse(BaseModel):
    """Response model for ML behavior analysis."""
    success: bool
    is_anomaly: bool
    confidence: float
    decision_score: Optional[float] = None
    message: Optional[str] = None
    requires_training: bool = False
    model_info: Optional[Dict] = None

class MLTrainingResponse(BaseModel):
    """Response model for ML model training."""
    success: bool
    message: str
    data_count: int
    model_path: Optional[str] = None
    baseline_stats: Optional[Dict] = None
    model_scores: Optional[Dict] = None

class MLModelInfoResponse(BaseModel):
    """Response model for ML model information."""
    model_exists: bool
    customer_id: Optional[str] = None
    trained_at: Optional[str] = None
    baseline_size: Optional[int] = None
    baseline_stats: Optional[Dict] = None
    model_scores: Optional[Dict] = None
    requires_training: bool = False
    data_count: Optional[int] = None
    message: Optional[str] = None

class AutoTrainRequest(BaseModel):
    """Request model for auto-training all eligible users."""
    min_sessions: int = Field(default=30, ge=5, description="Minimum sessions required for training")

class AutoTrainResponse(BaseModel):
    """Response model for auto-training results."""
    success: bool
    message: str
    total_eligible_users: int
    successful_trainings: int
    results: Optional[list] = None