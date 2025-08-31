# --- File: bank-app-frontend/behaviour_analysis/app/db/base.py ---
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import settings

# SQLite engine with specific configurations
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # Allow multiple threads
    pool_pre_ping=True,
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get a DB session in API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()