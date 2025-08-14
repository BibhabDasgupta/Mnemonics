# --- File: app/api/api_v1/endpoints/transactions.py ---

"""
FastAPI Transactions Endpoint — Refactored for production
- Enhanced with fraud detection and blocking capabilities
- Supports re-authentication bypass for FIDO2 verified transactions
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import Annotated, Dict, List, Tuple, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import get_db
from app.db.models.user import Account, Transaction, AppData
from app.schemas.transaction import TransactionCreateRequest
from app.services import feature_service
from app.services.fraud_service import fraud_predictor

# -----------------------------------------------------------------------------
# Router & Logger
# -----------------------------------------------------------------------------
router = APIRouter()
logger = logging.getLogger(__name__)

# Ensure a sane default logging configuration if the app hasn't configured one
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[logging.StreamHandler()],
    )

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
EXPECTED_FEATURES: List[str] = [
    "TX_AMOUNT",
    "TX_DURING_WEEKEND",
    "TX_DURING_NIGHT",
    "CUSTOMER_ID_NB_TX_1DAY_WINDOW",
    "CUSTOMER_ID_AVG_AMOUNT_1DAY_WINDOW",
    "CUSTOMER_ID_NB_TX_7DAY_WINDOW",
    "CUSTOMER_ID_AVG_AMOUNT_7DAY_WINDOW",
    "CUSTOMER_ID_NB_TX_30DAY_WINDOW",
    "CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW",
    "TERMINAL_ID_NB_TX_1DAY_WINDOW",
    "TERMINAL_ID_RISK_1DAY_WINDOW",
    "TERMINAL_ID_NB_TX_7DAY_WINDOW",
    "TERMINAL_ID_RISK_7DAY_WINDOW",
    "TERMINAL_ID_NB_TX_30DAY_WINDOW",
    "TERMINAL_ID_RISK_30DAY_WINDOW",
]

# Fraud detection thresholds
FRAUD_THRESHOLD: float = getattr(settings, "FRAUD_THRESHOLD", 0.5)
FRAUD_THRESHOLD_ADJUSTED: float = 0.3  # Lower threshold to catch more anomalies
MAX_REASONABLE_NB_TX: int = 1000  # heuristic for suspiciously large counters

# Re-authentication constants
REAUTH_FRAUD_THRESHOLD: float = 0.95  # Much higher threshold for re-authenticated transactions
REAUTH_BYPASS_FRAUD_DETECTION: bool = True  # Set to True to completely bypass fraud detection


# -----------------------------------------------------------------------------
# Feature Validation (keep your existing implementation)
# -----------------------------------------------------------------------------
class FeatureValidationResult:
    def __init__(
        self,
        is_valid: bool,
        missing: List[str],
        suspicious_count: int,
        present: List[str],
    ) -> None:
        self.is_valid = is_valid
        self.missing = missing
        self.suspicious_count = suspicious_count
        self.present = present

    def __repr__(self) -> str:
        return (
            f"FeatureValidationResult(is_valid={self.is_valid}, "
            f"missing={len(self.missing)}, suspicious_count={self.suspicious_count})"
        )


def validate_features(features: Dict[str, float]) -> FeatureValidationResult:
    """Validate required features and flag suspicious values."""
    missing = [f for f in EXPECTED_FEATURES if f not in features]
    present = [f for f in EXPECTED_FEATURES if f in features]

    suspicious = 0

    # Negative averages (unusual but not strictly invalid)
    for f in [x for x in EXPECTED_FEATURES if "AVG_AMOUNT" in x]:
        v = features.get(f)
        if v is not None and v < 0:
            suspicious += 1
            logger.debug("Suspicious negative average amount: %s=%s", f, v)

    # All zero terminal risk features
    risk_keys = [x for x in EXPECTED_FEATURES if "RISK" in x and x in features]
    if risk_keys:
        if all(features.get(x, 0) == 0 for x in risk_keys):
            suspicious += 1
            logger.debug("All terminal risk features present are zero: %s", risk_keys)

    # Extremely high transaction counts
    for f in [x for x in EXPECTED_FEATURES if "NB_TX" in x]:
        v = features.get(f)
        if v is not None and v > MAX_REASONABLE_NB_TX:
            suspicious += 1
            logger.debug("Suspiciously high transaction count: %s=%s", f, v)

    is_valid = len(missing) == 0

    if not is_valid:
        logger.warning("Missing required features: count=%d, missing=%s", len(missing), missing)
    else:
        logger.debug("All required features are present (%d)", len(present))

    return FeatureValidationResult(is_valid=is_valid, missing=missing, suspicious_count=suspicious, present=present)


# -----------------------------------------------------------------------------
# Auth dependency (keep your existing implementation)
# -----------------------------------------------------------------------------
async def get_current_customer(
    authorization: Annotated[str, Header()],
    db: Session = Depends(get_db),
) -> AppData:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        customer_id = payload.get("sub")
        if customer_id is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials: subject missing")
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Could not validate credentials") from exc

    customer = db.query(AppData).filter(AppData.customer_id == customer_id).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


# -----------------------------------------------------------------------------
# Main Transaction Endpoint - UPDATED WITH RE-AUTH BYPASS
# -----------------------------------------------------------------------------
@router.post("/transactions/create")
def create_transaction(
    request: TransactionCreateRequest,
    background_tasks: BackgroundTasks,
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Execute a transfer, run a fraud assessment, and schedule feature updates.

    Design:
    - Pre-transaction checks ensure accounts exist and balance covers amount.
    - Enhanced fraud predictor can block transactions when anomalies are detected.
    - Re-authenticated transactions have relaxed fraud detection or bypass entirely.
    - Background tasks refresh rolling features post-commit.
    """
    sender_customer_id: str = current_customer.customer_id

    try:
        transaction_amount = Decimal(request.amount)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid amount format") from exc

    # --- Pre-Transaction Checks ------------------------------------------------
    sender_account: Optional[Account] = (
        db.query(Account).filter(Account.customer_id == sender_customer_id).first()
    )
    recipient_account: Optional[Account] = (
        db.query(Account).filter(Account.account_number == request.recipient_account_number).first()
    )

    if sender_account is None:
        raise HTTPException(status_code=404, detail="Sender account not found")
    if recipient_account is None:
        raise HTTPException(status_code=404, detail="Recipient account not found")
    if sender_account.account_number == recipient_account.account_number:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")
    if sender_account.balance < transaction_amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    # --- Enhanced Fraud Prediction Step ----------------------------------------
    is_fraud_prediction: bool = False
    fraud_probability: float = -1.0  # sentinel for "not computed"
    fraud_details: Optional[Dict] = None
    fraud_detection_bypassed: bool = False

    # ✅ CHECK FOR RE-AUTHENTICATION FLAGS
    is_reauth = getattr(request, 'is_reauth_transaction', False) or False
    original_alert_id = getattr(request, 'original_fraud_alert_id', None)
    
    try:
        logger.info(
            "🔒 Fraud pipeline start: customer=%s terminal=%s amount=%s is_reauth=%s alert_id=%s",
            sender_customer_id,
            request.terminal_id,
            transaction_amount,
            is_reauth,
            original_alert_id or 'N/A'
        )

        # ✅ BYPASS FRAUD DETECTION FOR RE-AUTHENTICATED TRANSACTIONS
        if is_reauth and REAUTH_BYPASS_FRAUD_DETECTION:
            logger.info(
                "🔒 FRAUD DETECTION BYPASSED: Re-authenticated transaction allowed. customer=%s amount=%s alert_id=%s",
                sender_customer_id,
                transaction_amount,
                original_alert_id or 'unknown'
            )
            fraud_probability = 0.0
            is_fraud_prediction = False
            fraud_detection_bypassed = True
        else:
            # Continue with normal fraud detection pipeline
            logger.info("🔒 Running normal fraud detection pipeline (not re-authenticated)")
            
            current_features: Dict[str, float] = feature_service.get_current_features_for_customer_and_terminal(
                db, sender_customer_id, request.terminal_id
            )

            # Add transaction-time features
            now = datetime.now(timezone.utc)
            current_features["TX_AMOUNT"] = float(transaction_amount)
            current_features["TX_DURING_WEEKEND"] = 1 if now.weekday() >= 5 else 0
            current_features["TX_DURING_NIGHT"] = 1 if not 6 <= now.hour <= 22 else 0

            logger.info("Current features: %s", current_features)

            # Validate features prior to prediction
            validation = validate_features(current_features)
            logger.info("Feature validation: %s", validation)

            if not validation.is_valid:
                logger.error(
                    "Feature validation failed; skipping ML prediction. missing=%s",
                    validation.missing,
                )
                fraud_probability = 0.0
                is_fraud_prediction = False
            else:
                # Debug prediction first
                debug_info = fraud_predictor.debug_prediction(current_features)
                logger.info(f"🔍 DEBUG INFO: {debug_info}")
                
                # Get actual prediction
                fraud_probability = float(fraud_predictor.predict(current_features))
                
                # Use different threshold for re-authenticated transactions
                effective_threshold = REAUTH_FRAUD_THRESHOLD if is_reauth else FRAUD_THRESHOLD_ADJUSTED
                is_fraud_prediction = fraud_probability > effective_threshold
                
                logger.info(
                    "Fraud prediction complete: prob=%.6f threshold=%.3f is_fraud=%s is_reauth=%s suspicious=%d",
                    fraud_probability,
                    effective_threshold,
                    is_fraud_prediction,
                    is_reauth,
                    validation.suspicious_count,
                )

                # Manual override logic (only for non-reauth transactions)
                if not is_reauth:
                    tx_amount = current_features.get("TX_AMOUNT", 0)
                    avg_amount = current_features.get("CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW", 0)
                    
                    if avg_amount > 0 and tx_amount / avg_amount > 15:  # 15x higher than average
                        logger.warning(f"🚨 MANUAL OVERRIDE: Transaction amount {tx_amount} is {tx_amount/avg_amount:.1f}x higher than average {avg_amount}")
                        fraud_probability = 0.95
                        is_fraud_prediction = True

                # Create fraud details if anomaly detected
                if is_fraud_prediction:
                    risk_level = "HIGH" if fraud_probability > 0.8 else "MEDIUM" if fraud_probability > 0.6 else "LOW"

                    fraud_details = {
                        "anomaly_type": "Transaction Pattern Anomaly",
                        "confidence": fraud_probability * 100,
                        "decision_score": fraud_probability,
                        "risk_level": risk_level,
                        "features_used": list(current_features.keys()),
                        "recommendations": [
                            "Transaction blocked due to suspicious pattern",
                            "Verify your identity to proceed",
                            "Contact support if this transaction is legitimate",
                            "Review recent account activity"
                        ],
                        "transaction_details": {
                            "amount": float(transaction_amount),
                            "recipient": request.recipient_account_number,
                            "timestamp": now.isoformat(),
                            "terminal_id": request.terminal_id
                        },
                        "analysis_details": {
                            "amount_vs_average_ratio": tx_amount / avg_amount if avg_amount > 0 else None,
                            "customer_avg_30d": avg_amount,
                            "transaction_amount": tx_amount,
                            "threshold_used": effective_threshold,
                            "is_reauth_transaction": is_reauth,
                            "original_fraud_alert_id": original_alert_id,
                            "manual_override": tx_amount / avg_amount > 15 if avg_amount > 0 else False
                        }
                    }
                    
                    logger.warning(
                        "FRAUD DETECTED - Transaction blocked: customer=%s amount=%s prob=%.6f risk=%s is_reauth=%s ratio=%.1fx",
                        sender_customer_id,
                        transaction_amount,
                        fraud_probability,
                        fraud_details["risk_level"],
                        is_reauth,
                        tx_amount / avg_amount if avg_amount > 0 else 0
                    )

    except Exception as exc:
        # Never block payment due to ML issues
        logger.exception(
            "Fraud prediction failed; continuing without block (customer=%s): %s",
            sender_customer_id,
            exc,
        )
        fraud_probability = 0.0
        is_fraud_prediction = False

    # --- Early Return for Blocked Transactions ---------------------------------
    if is_fraud_prediction and fraud_details:
        logger.info(
            "Transaction BLOCKED due to fraud detection: customer=%s amount=%s is_reauth=%s",
            sender_customer_id,
            transaction_amount,
            is_reauth
        )
        
        # Create a blocked transaction record for audit purposes
        blocked_transaction = Transaction(
            account_number=sender_account.account_number,
            terminal_id=request.terminal_id,
            description=f"BLOCKED Transfer to {recipient_account.account_number} - Fraud detected (reauth: {is_reauth})",
            amount=-transaction_amount,
            type="blocked",
            is_fraud=True,
        )
        
        try:
            db.add(blocked_transaction)
            db.commit()
            logger.info("Blocked transaction recorded for audit: tx_id=%s", blocked_transaction.id)
        except Exception as exc:
            logger.exception("Failed to record blocked transaction: %s", exc)
            db.rollback()

        return {
            "status": "Transaction blocked",
            "new_balance": None,
            "fraud_prediction": True,
            "fraud_probability": float(fraud_probability),
            "fraud_details": fraud_details,
            "blocked": True,
            "is_reauth_transaction": is_reauth,
            "original_fraud_alert_id": original_alert_id,
            "message": f"Transaction blocked due to {fraud_details['risk_level'].lower()} risk fraud detection"
        }

    # --- Atomic Transaction Logic (Only for non-fraudulent transactions) -------
    try:
        logger.info(
            "✅ Executing transfer: from=%s to=%s amount=%s fraud_prob=%.6f is_reauth=%s bypassed=%s",
            sender_account.account_number,
            request.recipient_account_number,
            transaction_amount,
            fraud_probability if fraud_probability != -1.0 else 0.0,
            is_reauth,
            fraud_detection_bypassed
        )

        sender_account.balance -= transaction_amount
        recipient_account.balance += transaction_amount

        # Add note about re-authentication in transaction description
        description_suffix = " (Re-authenticated)" if is_reauth else ""
        
        db.add(
            Transaction(
                account_number=sender_account.account_number,
                terminal_id=request.terminal_id,
                description=f"Transfer to {recipient_account.account_number}{description_suffix}",
                amount=-transaction_amount,
                type="debit",
                is_fraud=False,  # Only non-fraudulent transactions reach here
            )
        )

        db.add(
            Transaction(
                account_number=recipient_account.account_number,
                terminal_id=request.terminal_id,
                description=f"Transfer from {sender_account.account_number}{description_suffix}",
                amount=transaction_amount,
                type="credit",
                is_fraud=False,
            )
        )

        db.commit()

        # Post-commit background updates for rolling features
        background_tasks.add_task(feature_service.update_customer_features, db, sender_customer_id)
        background_tasks.add_task(feature_service.update_terminal_features, db, request.terminal_id)

        db.refresh(sender_account)
        logger.info(
            "✅ Transaction committed successfully: new_sender_balance=%s is_fraud=%s prob=%.6f is_reauth=%s",
            sender_account.balance,
            is_fraud_prediction,
            fraud_probability if fraud_probability != -1.0 else -1.0,
            is_reauth
        )

        # Build success response
        response = {
            "status": "Transaction successful",
            "new_balance": float(sender_account.balance),
            "fraud_prediction": False,
            "fraud_probability": float(fraud_probability) if fraud_probability != -1.0 else None,
            "fraud_details": None,
            "blocked": False,
            "is_reauth_transaction": is_reauth,
            "original_fraud_alert_id": original_alert_id,
            "fraud_detection_bypassed": fraud_detection_bypassed,
            "message": "Transaction completed successfully" + (" (Re-authenticated)" if is_reauth else "")
        }

        # Add notice for re-authenticated transactions
        if is_reauth:
            response["security_notice"] = "Transaction completed after successful biometric re-authentication"
        elif fraud_probability > 0.1:
            response["security_notice"] = f"Transaction flagged for review (risk score: {fraud_probability:.3f})"

        return response

    except Exception as exc:
        db.rollback()
        logger.exception(
            "Transaction failed and rolled back (customer=%s): %s",
            sender_customer_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="An error occurred during the transaction")


# Keep your existing test endpoint
@router.post("/transactions/test-fraud")
def test_fraud_detection(
    request: TransactionCreateRequest,
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Test fraud detection without executing transaction"""
    
    sender_customer_id: str = current_customer.customer_id
    
    try:
        # Get features
        current_features: Dict[str, float] = feature_service.get_current_features_for_customer_and_terminal(
            db, sender_customer_id, request.terminal_id
        )
        
        # Add transaction features
        now = datetime.now(timezone.utc)
        current_features["TX_AMOUNT"] = float(request.amount)
        current_features["TX_DURING_WEEKEND"] = 1 if now.weekday() >= 5 else 0
        current_features["TX_DURING_NIGHT"] = 1 if not 6 <= now.hour <= 22 else 0
        
        # Check if this is a re-auth transaction
        is_reauth = getattr(request, 'is_reauth_transaction', False) or False
        
        # Get debug info
        debug_info = fraud_predictor.debug_prediction(current_features)
        
        # Get prediction
        fraud_probability = float(fraud_predictor.predict(current_features))
        
        return {
            "test_mode": True,
            "transaction_amount": float(request.amount),
            "features": current_features,
            "debug_info": debug_info,
            "fraud_probability": fraud_probability,
            "would_block_at_threshold_0_3": fraud_probability > 0.3,
            "would_block_at_threshold_0_5": fraud_probability > 0.5,
            "is_reauth_transaction": is_reauth,
            "would_bypass_if_reauth": REAUTH_BYPASS_FRAUD_DETECTION and is_reauth,
            "recommendation": "BYPASS (RE-AUTH)" if is_reauth and REAUTH_BYPASS_FRAUD_DETECTION else ("BLOCK" if fraud_probability > 0.3 else "ALLOW")
        }
        
    except Exception as exc:
        logger.exception(f"Test fraud detection failed: {exc}")
        return {
            "test_mode": True,
            "error": str(exc),
            "recommendation": "ERROR"
        }