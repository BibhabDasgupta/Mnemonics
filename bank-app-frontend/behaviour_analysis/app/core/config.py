# --- File: bank-app-frontend/behaviour_analysis/app/core/config.py ---
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Core Project Settings
    PROJECT_NAME: str
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: str
    DATABASE_URL: str = "sqlite:///./behavioral_analysis.db"
    RP_ID: str
    RP_NAME: str
    ORIGIN: AnyHttpUrl
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_VERIFY_SERVICE_SID: str
    TWILIO_PHONE_NUMBER: str
    PRIVATE_KEY: str
    JWT_SECRET: str = "your_jwt_secret_here"

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()