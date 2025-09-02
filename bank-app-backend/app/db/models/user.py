# Enhanced database models with device tracking and seedkey attempts
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Boolean, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base

class Account(Base):
    __tablename__ = "account"
    account_number = Column(String, primary_key=True, index=True)
    customer_id = Column(String, nullable=False)
    account_type = Column(String, nullable=False, default="Savings")
    balance = Column(Numeric(10, 2), nullable=False, default=0.00)     
    atm_pin_hash = Column(String, nullable=True)
    pin_attempts = Column(Integer, default=0, nullable=False)
    pin_locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String, ForeignKey("account.account_number"), nullable=False)
    terminal_id = Column(String, index=True, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(String, nullable=False)  # 'credit' or 'debit'
    is_fraud = Column(Boolean, default=False, nullable=False)
    is_reauth_transaction = Column(Boolean, default=False, nullable=False)
    auth_method = Column(String, nullable=True)
    recipient_name = Column(String, nullable=True)  # Added for SMS notifications

    account = relationship("Account", back_populates="transactions")

class Passkey(Base):
    __tablename__ = "passkeys"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, nullable=False, index=True)
    credential_id = Column(LargeBinary, unique=True, nullable=False)
    public_key = Column(LargeBinary, nullable=False)
    symmetric_key = Column(String, nullable=True)
    sign_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Seedkey(Base):
    __tablename__ = "seedkeys"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, nullable=False, index=True)
    public_key = Column(String, nullable=False, unique=True)
    user_id = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AppData(Base):
    __tablename__ = "app_data"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=False)
    aadhaar_number = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    app_access_revoked = Column(Boolean, default=False, nullable=False)
    last_logged_in_ip = Column(String, nullable=True)
    last_logged_in_location = Column(String, nullable=True)
    last_logged_in_time = Column(DateTime(timezone=True), nullable=True)
    other_details = Column(JSONB, nullable=True, default='[]')  # Enhanced to store device history
    no_of_logged_in_devices = Column(Integer, default=0, nullable=False)
    last_restored_at = Column(DateTime(timezone=True), nullable=True)
    is_restoration_limited = Column(Boolean, default=False, nullable=False)
    restoration_daily_limit = Column(Numeric(10, 2), default=5000.00, nullable=False)
    restoration_limit_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    login_blocked_until = Column(DateTime(timezone=True), nullable=True)
    last_failed_attempt_time = Column(DateTime(timezone=True), nullable=True)
    
    # New fields for seedkey attempt tracking
    seedkey_failed_attempts = Column(Integer, default=0, nullable=False)
    seedkey_blocked_until = Column(DateTime(timezone=True), nullable=True)
    last_seedkey_attempt_time = Column(DateTime(timezone=True), nullable=True)

class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, nullable=False, index=True)
    attempt_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    location = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)

class SeedkeyAttempt(Base):
    """New table to track seedkey verification attempts"""
    __tablename__ = "seedkey_attempts"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, nullable=False, index=True)
    attempt_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    location = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)