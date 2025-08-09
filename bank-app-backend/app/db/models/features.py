# --- File: app/db/models/features.py ---

from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime

class CustomerFraudFeatures(Base):
    """
    Stores pre-aggregated fraud-related features for each customer.
    This table is updated asynchronously after each transaction.
    """
    __tablename__ = "customer_fraud_features"
    customer_id = Column(String, primary_key=True, index=True)
    nb_tx_1day_window = Column(Float, default=0.0)
    avg_amount_1day_window = Column(Float, default=0.0)
    nb_tx_7day_window = Column(Float, default=0.0)
    avg_amount_7day_window = Column(Float, default=0.0)
    nb_tx_30day_window = Column(Float, default=0.0)
    avg_amount_30day_window = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TerminalFraudFeatures(Base):
    """
    Stores pre-aggregated fraud-related features for each terminal.
    This table is updated asynchronously after each transaction.
    """
    __tablename__ = "terminal_fraud_features"
    terminal_id = Column(String, primary_key=True, index=True)
    nb_tx_1day_window = Column(Float, default=0.0)
    risk_1day_window = Column(Float, default=0.0)
    nb_tx_7day_window = Column(Float, default=0.0)
    risk_7day_window = Column(Float, default=0.0)
    nb_tx_30day_window = Column(Float, default=0.0)
    risk_30day_window = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())