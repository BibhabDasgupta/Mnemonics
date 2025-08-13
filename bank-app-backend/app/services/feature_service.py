# --- File: app/services/feature_service.py ---

import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta

# Correctly import the feature models and the Transaction model
from app.db.models.features import CustomerFraudFeatures, TerminalFraudFeatures
from app.db.models.user import Account, Transaction

logger = logging.getLogger(__name__)


def get_current_features_for_customer_and_terminal(db: Session, customer_id: str, terminal_id: str) -> dict:
    """
    Retrieves the most recent pre-computed features for a given customer and terminal.
    """
    customer_features = db.query(CustomerFraudFeatures).filter(CustomerFraudFeatures.customer_id == customer_id).first()
    terminal_features = db.query(TerminalFraudFeatures).filter(TerminalFraudFeatures.terminal_id == terminal_id).first()

    features = {}

    # --- Customer-level features ---
    if customer_features:
        features['CUSTOMER_ID_NB_TX_1DAY_WINDOW'] = customer_features.nb_tx_1day_window
        features['CUSTOMER_ID_AVG_AMOUNT_1DAY_WINDOW'] = customer_features.avg_amount_1day_window
        features['CUSTOMER_ID_NB_TX_7DAY_WINDOW'] = customer_features.nb_tx_7day_window
        features['CUSTOMER_ID_AVG_AMOUNT_7DAY_WINDOW'] = customer_features.avg_amount_7day_window
        features['CUSTOMER_ID_NB_TX_30DAY_WINDOW'] = customer_features.nb_tx_30day_window
        features['CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW'] = customer_features.avg_amount_30day_window
    else:
        # Default values if no historical features exist for the customer
        features.update({
            'CUSTOMER_ID_NB_TX_1DAY_WINDOW': 0, 'CUSTOMER_ID_AVG_AMOUNT_1DAY_WINDOW': 0.0,
            'CUSTOMER_ID_NB_TX_7DAY_WINDOW': 0, 'CUSTOMER_ID_AVG_AMOUNT_7DAY_WINDOW': 0.0,
            'CUSTOMER_ID_NB_TX_30DAY_WINDOW': 0, 'CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW': 0.0,
        })

    # --- Terminal-level features ---
    if terminal_features:
        features['TERMINAL_ID_NB_TX_1DAY_WINDOW'] = terminal_features.nb_tx_1day_window
        features['TERMINAL_ID_RISK_1DAY_WINDOW'] = terminal_features.risk_1day_window
        features['TERMINAL_ID_NB_TX_7DAY_WINDOW'] = terminal_features.nb_tx_7day_window
        features['TERMINAL_ID_RISK_7DAY_WINDOW'] = terminal_features.risk_7day_window
        features['TERMINAL_ID_NB_TX_30DAY_WINDOW'] = terminal_features.nb_tx_30day_window
        features['TERMINAL_ID_RISK_30DAY_WINDOW'] = terminal_features.risk_30day_window
    else:
        # Default values if no historical features exist for the terminal
        features.update({
            'TERMINAL_ID_NB_TX_1DAY_WINDOW': 0, 'TERMINAL_ID_RISK_1DAY_WINDOW': 0.0,
            'TERMINAL_ID_NB_TX_7DAY_WINDOW': 0, 'TERMINAL_ID_RISK_7DAY_WINDOW': 0.0,
            'TERMINAL_ID_NB_TX_30DAY_WINDOW': 0, 'TERMINAL_ID_RISK_30DAY_WINDOW': 0.0,
        })
        
    return features


def update_customer_features(db: Session, customer_id: str):
    """
    (Background Task) Calculates and updates aggregated transaction features for a customer.
    This version correctly calculates the average amount based only on debit transactions.
    """
    try:
        now = datetime.utcnow()
        day_1_ago = now - timedelta(days=1)
        day_7_ago = now - timedelta(days=7)
        day_30_ago = now - timedelta(days=30)

        # Query to get aggregated data for DEBIT transactions only
        result = db.query(
            func.count(case((Transaction.date >= day_1_ago, Transaction.id))).label("nb_tx_1day"),
            # FIX: Calculate average on the ABSOLUTE value of debit amounts
            func.avg(case((Transaction.date >= day_1_ago, func.abs(Transaction.amount)))).label("avg_amount_1day"),
            func.count(case((Transaction.date >= day_7_ago, Transaction.id))).label("nb_tx_7day"),
            func.avg(case((Transaction.date >= day_7_ago, func.abs(Transaction.amount)))).label("avg_amount_7day"),
            func.count(case((Transaction.date >= day_30_ago, Transaction.id))).label("nb_tx_30day"),
            func.avg(case((Transaction.date >= day_30_ago, func.abs(Transaction.amount)))).label("avg_amount_30day")
        ).join(Account, Transaction.account_number == Account.account_number).filter(
            Account.customer_id == customer_id,
            Transaction.type == 'debit' # Ensure we only look at debits
        ).one()

        # ORM-based upsert logic
        features_record = db.query(CustomerFraudFeatures).filter(CustomerFraudFeatures.customer_id == customer_id).first()
        if not features_record:
            features_record = CustomerFraudFeatures(customer_id=customer_id)
            db.add(features_record)

        features_record.nb_tx_1day_window = result.nb_tx_1day or 0
        features_record.avg_amount_1day_window = float(result.avg_amount_1day or 0.0)
        features_record.nb_tx_7day_window = result.nb_tx_7day or 0
        features_record.avg_amount_7day_window = float(result.avg_amount_7day or 0.0)
        features_record.nb_tx_30day_window = result.nb_tx_30day or 0
        features_record.avg_amount_30day_window = float(result.avg_amount_30day or 0.0)
        
        db.commit()
        logger.info(f"Successfully updated fraud features for customer {customer_id}")

    except Exception as e:
        logger.error(f"Failed to update fraud features for customer {customer_id}: {e}")
        db.rollback()


def update_terminal_features(db: Session, terminal_id: str):
    """
    (Background Task) Calculates and updates aggregated features for a terminal.
    """
    try:
        now = datetime.utcnow()
        day_1_ago = now - timedelta(days=1)
        day_7_ago = now - timedelta(days=7)
        day_30_ago = now - timedelta(days=30)
        
        # This query correctly calculates risk based on the is_fraud flag.
        # The 0.0 values likely mean no fraud has been recorded for this terminal yet.
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

        terminal_record.nb_tx_1day_window = result.nb_tx_1day or 0
        terminal_record.risk_1day_window = float(result.risk_1day or 0.0)
        terminal_record.nb_tx_7day_window = result.nb_tx_7day or 0
        terminal_record.risk_7day_window = float(result.risk_7day or 0.0)
        terminal_record.nb_tx_30day_window = result.nb_tx_30day or 0
        terminal_record.risk_30day_window = float(result.risk_30day or 0.0)
        
        db.commit()
        logger.info(f"Successfully updated fraud features for terminal {terminal_id}")
    except Exception as e:
        logger.error(f"Failed to update fraud features for terminal {terminal_id}: {e}")
        db.rollback()
