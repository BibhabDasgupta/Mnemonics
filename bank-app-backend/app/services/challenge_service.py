from sqlalchemy.orm import Session
from app.db.models.challenge import Challenge, ChallengeType
from datetime import datetime
import secrets

def generate_challenge() -> str:
    return secrets.token_hex(32)

def create_challenge(db: Session, challenge: str, customer_id: str, challenge_type: ChallengeType, expires_at: datetime):
    db_challenge = Challenge(
        customer_id=customer_id,
        challenge_string=challenge,
        challenge_type=challenge_type,
        expires_at=expires_at,
        created_at=datetime.utcnow()
    )
    db.add(db_challenge)
    db.commit()
    return db_challenge

def get_and_delete_challenge(db: Session, challenge: str):
    db_challenge = db.query(Challenge).filter(Challenge.challenge_string == challenge).first()
    if db_challenge and db_challenge.expires_at > datetime.utcnow():
        db.delete(db_challenge)
        db.commit()
        return db_challenge
    return None