from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Boolean, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base

class Account(Base):
    __tablename__ = "account"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, nullable=False, index=True)
    account_number = Column(String, unique=True, nullable=False)
    account_type = Column(String, nullable=False, default="Savings")
    balance = Column(Numeric(10, 2), nullable=False, default=0.00)                  
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("account.id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(String, nullable=False)  # 'credit' or 'debit'

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
    other_details = Column(JSONB, nullable=True, default='[]')
    no_of_logged_in_devices = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
