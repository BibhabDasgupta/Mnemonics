# from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLAlchemyEnum
# from sqlalchemy.sql import func
# from app.db.base import Base
# import enum

# # Define an enum for the types of challenges
# class ChallengeType(enum.Enum):
#     FIDO2 = "fido2"
#     SEEDKEY = "seedkey"

# class Challenge(Base):
#     __tablename__ = "challenges"

#     challenge_string = Column(String, primary_key=True, index=True)
#     customer_id = Column(String, ForeignKey("customers.customer_id"), nullable=False, index=True)   
    
#     # --- THIS IS THE FIX ---
#     # Differentiates between a FIDO challenge and a seed key challenge
#     challenge_type = Column(SQLAlchemyEnum(ChallengeType), nullable=False)
#     # -----------------------
    
#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#     expires_at = Column(DateTime(timezone=True), nullable=False)


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