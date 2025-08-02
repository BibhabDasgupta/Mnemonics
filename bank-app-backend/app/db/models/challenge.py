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


from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLAlchemyEnum
from sqlalchemy.sql import func
from app.db.base import Base
import enum

class ChallengeType(enum.Enum):
    FIDO2 = "fido2"
    SEEDKEY = "seedkey"

class Challenge(Base):
    __tablename__ = "challenges"

    challenge_string = Column(String, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("account.customer_id"), nullable=False, index=True)
    challenge_type = Column(SQLAlchemyEnum(ChallengeType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)