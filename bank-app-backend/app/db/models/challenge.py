# --- File: app/db/models/challenge.py ---
from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class ChallengeType(enum.Enum):
    FIDO2 = "FIDO2"
    SEEDKEY = "SEEDKEY"

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, index=True, nullable=False)
    challenge_string = Column(String, nullable=False)
    challenge_type = Column(Enum(ChallengeType), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)