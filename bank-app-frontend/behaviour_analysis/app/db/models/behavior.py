# --- File: bank-app-frontend/behaviour_analysis/app/db/models/behavior.py ---
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class UserBehavior(Base):
    """
    Represents a single record of user behavioral metrics.
    This class is the ORM model that maps to the 'user_behavior' table.
    Modified for SQLite compatibility.
    """
    __tablename__ = 'user_behavior'

    id = Column(Integer, primary_key=True, index=True)
    customer_unique_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    flight_avg = Column(Float, nullable=False)
    traj_avg = Column(Float, nullable=False)
    typing_speed = Column(Float, nullable=False)
    correction_rate = Column(Float, nullable=False)
    clicks_per_minute = Column(Float, nullable=False)

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<UserBehavior session_id={self.session_id}>"