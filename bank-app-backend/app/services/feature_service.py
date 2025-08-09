# --- File: app/services/feature_service.py ---

from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.db.models.features import CustomerFraudFeatures, TerminalFraudFeatures
from app.db.models.user import Account, Transaction
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def update_customer_features(db: Session, customer_id: str):
    """
    Calculates and updates aggregated transaction features for a customer using SQLAlchemy ORM.
    """
    try:
        now = datetime.utcnow()
        day_1_ago = now - timedelta(days=1)
        day_7_ago = now - timedelta(days=7)
        day_30_ago = now - timedelta(days=30)

        # ORM query to get aggregated data in one go
        result = db.query(
            func.count(case((Transaction.date >= day_1_ago, Transaction.id))).label("nb_tx_1day"),
            func.avg(case((Transaction.date >= day_1_ago, Transaction.amount))).label("avg_amount_1day"),
            func.count(case((Transaction.date >= day_7_ago, Transaction.id))).label("nb_tx_7day"),
            func.avg(case((Transaction.date >= day_7_ago, Transaction.amount))).label("avg_amount_7day"),
            func.count(case((Transaction.date >= day_30_ago, Transaction.id))).label("nb_tx_30day"),
            func.avg(case((Transaction.date >= day_30_ago, Transaction.amount))).label("avg_amount_30day")
        # MODIFIED: Join condition updated to use account_number
        ).join(Account, Transaction.account_number == Account.account_number).filter(
            Account.customer_id == customer_id,
            Transaction.type == 'debit'
        ).one()

        # ORM-based upsert logic
        features_record = db.query(CustomerFraudFeatures).filter(CustomerFraudFeatures.customer_id == customer_id).first()
        if not features_record:
            features_record = CustomerFraudFeatures(customer_id=customer_id)
            db.add(features_record)

        features_record.nb_tx_1day_window = result.nb_tx_1day or 0.0
        features_record.avg_amount_1day_window = float(result.avg_amount_1day or 0.0)
        features_record.nb_tx_7day_window = result.nb_tx_7day or 0.0
        features_record.avg_amount_7day_window = float(result.avg_amount_7day or 0.0)
        features_record.nb_tx_30day_window = result.nb_tx_30day or 0.0
        features_record.avg_amount_30day_window = float(result.avg_amount_30day or 0.0)
        
        db.commit()
        logger.info(f"Successfully updated fraud features for customer {customer_id}")

    except Exception as e:
        logger.error(f"Failed to update fraud features for customer {customer_id}: {e}")
        db.rollback()

# ... (update_terminal_features remains the same as it does not join with the Account table) ...
def update_terminal_features(db: Session, terminal_id: str):
    """
    Calculates and updates aggregated features for a terminal using SQLAlchemy ORM.
    """
    try:
        now = datetime.utcnow()
        day_1_ago = now - timedelta(days=1)
        day_7_ago = now - timedelta(days=7)
        day_30_ago = now - timedelta(days=30)
        
        # ORM query for terminal features
        result = db.query(
            func.count(case((Transaction.date >= day_1_ago, Transaction.id))).label("nb_tx_1day"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).filter(Transaction.date >= day_1_ago).label("risk_1day"),
            func.count(case((Transaction.date >= day_7_ago, Transaction.id))).label("nb_tx_7day"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).filter(Transaction.date >= day_7_ago).label("risk_7day"),
            func.count(case((Transaction.date >= day_30_ago, Transaction.id))).label("nb_tx_30day"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).filter(Transaction.date >= day_30_ago).label("risk_30day")
        ).filter(Transaction.terminal_id == terminal_id).one()
        
        # ORM-based upsert logic
        terminal_record = db.query(TerminalFraudFeatures).filter(TerminalFraudFeatures.terminal_id == terminal_id).first()
        if not terminal_record:
            terminal_record = TerminalFraudFeatures(terminal_id=terminal_id)
            db.add(terminal_record)

        terminal_record.nb_tx_1day_window = result.nb_tx_1day or 0.0
        terminal_record.risk_1day_window = float(result.risk_1day or 0.0)
        terminal_record.nb_tx_7day_window = result.nb_tx_7day or 0.0
        terminal_record.risk_7day_window = float(result.risk_7day or 0.0)
        terminal_record.nb_tx_30day_window = result.nb_tx_30day or 0.0
        terminal_record.risk_30day_window = float(result.risk_30day or 0.0)
        
        db.commit()
        logger.info(f"Successfully updated fraud features for terminal {terminal_id}")
    except Exception as e:
        logger.error(f"Failed to update fraud features for terminal {terminal_id}: {e}")
        db.rollback()