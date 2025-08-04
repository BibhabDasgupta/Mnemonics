from sqlalchemy.orm import Session
from app.db.models.challenge import Challenge, ChallengeType
from datetime import datetime, timedelta
import secrets

def create_challenge(db: Session, challenge: str, customer_id: str, challenge_type: ChallengeType, expires_at: datetime):
    db_challenge = Challenge(
        challenge_string=challenge,
        customer_id=customer_id,
        challenge_type=challenge_type,
        expires_at=expires_at
    )
    db.add(db_challenge)
    db.commit()
    return db_challenge

def get_and_delete_challenge(db: Session, challenge: str):
    db_challenge = db.query(Challenge).filter(
        Challenge.challenge_string == challenge,
        Challenge.expires_at > datetime.utcnow()
    ).first()
    if db_challenge:
        db.delete(db_challenge)
        db.commit()
    return db_challenge

def generate_challenge():
    return secrets.token_hex(32)