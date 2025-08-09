from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID # Use the specific UUID type for PostgreSQL
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class UserBehavior(Base):
    """
    Represents a single record of user behavioral metrics.
    This class is the ORM model that maps to the 'user_behavior' table.
    """
    __tablename__ = 'user_behavior'

    id = Column(Integer, primary_key=True, index=True)
    # --- MODIFIED: Renamed to customer_unique_id and changed type to UUID ---
    # The frontend must provide this ID to link the behavior to a specific customer.
    customer_unique_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    session_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    flight_avg = Column(Float, nullable=False)
    traj_avg = Column(Float, nullable=False)
    typing_speed = Column(Float, nullable=False)
    correction_rate = Column(Float, nullable=False)
    clicks_per_minute = Column(Float, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<UserBehavior session_id={self.session_id}>"
