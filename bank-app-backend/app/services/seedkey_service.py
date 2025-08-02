from sqlalchemy.orm import Session
from app.db.models.user import Seedkey
from app.schemas.seedkey import SeedkeyCreate

def create_seedkey_for_customer(db: Session, customer_id: str, public_key: str) -> Seedkey:
    db_seedkey = Seedkey(
        customer_id=customer_id,
        public_key=public_key,
    )
    db.add(db_seedkey)
    db.commit()
    db.refresh(db_seedkey)
    return db_seedkey