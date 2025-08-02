from sqlalchemy.orm import Session
from app.db.models.challenge import Challenge, ChallengeType # Import ChallengeType
from datetime import datetime

# --- THIS IS THE FIX ---
def create_challenge(db: Session, challenge: str, customer_id: str, expires_at: datetime, challenge_type: ChallengeType) -> Challenge:
    """
    Creates and saves a new challenge record in the database.
    """
    db_challenge = Challenge(
        challenge_string=challenge,
        customer_id=customer_id,
        expires_at=expires_at,
        challenge_type=challenge_type # Save the type of challenge
    )
    db.add(db_challenge)
    db.commit()
    db.refresh(db_challenge)
    return db_challenge
# --------------------

def get_challenge(db: Session, challenge: str) -> Challenge | None:
    return db.query(Challenge).filter(Challenge.challenge_string == challenge).first()

def get_and_delete_challenge(db: Session, challenge: str) -> Challenge | None:
    """
    Atomically retrieves and deletes a challenge to prevent reuse.
    """
    db_challenge = get_challenge(db, challenge)
    if db_challenge:
        db.delete(db_challenge)
        db.commit()
    return db_challenge

def delete_expired_challenges(db: Session):
    """Deletes all challenges that have passed their expiration time."""
    db.query(Challenge).filter(Challenge.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    db.commit()