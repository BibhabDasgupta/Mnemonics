# --- File: app/api/api_v1/endpoints/transactions.py ---

"""
FastAPI Transactions Endpoint — Refactored for production
- Removes console prints and emojis
- Uses structured logging and clear error handling
- Adds type hints and constants
- Keeps original behavior: never blocks a transaction due to ML errors; logs instead
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

# Allow overriding via application settings; default to 0.5 if not present.
FRAUD_THRESHOLD: float = getattr(settings, "FRAUD_THRESHOLD", 0.5)
MAX_REASONABLE_NB_TX: int = 1000  # heuristic for suspiciously large counters


# -----------------------------------------------------------------------------
# Feature Validation
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

    def __repr__(self) -> str:  # helpful in logs
        return (
            f"FeatureValidationResult(is_valid={self.is_valid}, "
            f"missing={len(self.missing)}, suspicious_count={self.suspicious_count})"
        )


def validate_features(features: Dict[str, float]) -> FeatureValidationResult:
    """Validate required features and flag suspicious values.

    Rules:
    - All EXPECTED_FEATURES must be present.
    - Negative AVG_AMOUNT values are flagged as suspicious.
    - All-zero RISK values are flagged as suspicious (may indicate calc issues).
    - Extremely high NB_TX values (> MAX_REASONABLE_NB_TX) are suspicious.
    """
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
# Auth dependency
# -----------------------------------------------------------------------------
async def get_current_customer(
    authorization: Annotated[str, Header()],
    db: Session = Depends(get_db),
) -> AppData:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])  # type: ignore[arg-type]
        customer_id = payload.get("sub")
        if customer_id is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials: subject missing")
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.PyJWTError as exc:  # broad JWT decode failures
        raise HTTPException(status_code=401, detail="Could not validate credentials") from exc

    customer = db.query(AppData).filter(AppData.customer_id == customer_id).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


# -----------------------------------------------------------------------------
# Endpoint
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
    - Fraud predictor is best-effort: errors do not block the transfer.
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

    # --- Fraud Prediction Step -------------------------------------------------
    is_fraud_prediction: bool = False
    fraud_probability: float = -1.0  # sentinel for "not computed"

    try:
        logger.info(
            "Fraud pipeline start: customer=%s terminal=%s amount=%s",
            sender_customer_id,
            request.terminal_id,
            transaction_amount,
        )

        # 1) Fetch rolling features for this customer/terminal
        current_features: Dict[str, float] = feature_service.get_current_features_for_customer_and_terminal(
            db, sender_customer_id, request.terminal_id
        )

        # 2) Add transaction-time features
        now = datetime.now(timezone.utc)
        current_features["TX_AMOUNT"] = float(transaction_amount)
        current_features["TX_DURING_WEEKEND"] = 1 if now.weekday() >= 5 else 0
        current_features["TX_DURING_NIGHT"] = 1 if not 6 <= now.hour <= 22 else 0

        logger.debug(
            "TX features: amount=%s weekend=%s night=%s at=%s",
            current_features["TX_AMOUNT"],
            current_features["TX_DURING_WEEKEND"],
            current_features["TX_DURING_NIGHT"],
            now.isoformat(),
        )

        # 3) Validate features prior to prediction
        validation = validate_features(current_features)
        logger.info("Feature validation: %s", validation)

        if not validation.is_valid:
            # Do not fail the transaction; log and default to non-fraudulent
            logger.error(
                "Feature validation failed; skipping ML prediction. missing=%s",
                validation.missing,
            )
            fraud_probability = 0.0
            is_fraud_prediction = False
        else:
            # 4) Predict
            fraud_probability = float(fraud_predictor.predict(current_features))
            is_fraud_prediction = fraud_probability > FRAUD_THRESHOLD
            logger.info(
                "Fraud prediction complete: prob=%.6f threshold=%.3f is_fraud=%s suspicious=%d",
                fraud_probability,
                FRAUD_THRESHOLD,
                is_fraud_prediction,
                validation.suspicious_count,
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

    # --- Atomic Transaction Logic ---------------------------------------------
    try:
        logger.info(
            "Executing transfer: from=%s to=%s amount=%s",
            sender_account.account_number,
            request.recipient_account_number,
            transaction_amount,
        )

        sender_account.balance -= transaction_amount
        recipient_account.balance += transaction_amount

        db.add(
            Transaction(
                account_number=sender_account.account_number,
                terminal_id=request.terminal_id,
                description=f"Transfer to {recipient_account.account_number}",
                amount=-transaction_amount,
                type="debit",
                is_fraud=bool(is_fraud_prediction),
            )
        )

        db.add(
            Transaction(
                account_number=recipient_account.account_number,
                terminal_id=request.terminal_id,
                description=f"Transfer from {sender_account.account_number}",
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
            "Transaction committed successfully: new_sender_balance=%s is_fraud=%s prob=%.6f",
            sender_account.balance,
            is_fraud_prediction,
            fraud_probability if fraud_probability != -1.0 else -1.0,
        )

        return {
            "status": "Transaction successful",
            "new_balance": sender_account.balance,
            "fraud_prediction": bool(is_fraud_prediction),
            "fraud_probability": (
                float(fraud_probability) if fraud_probability != -1.0 else None
            ),
        }

    except Exception as exc:
        db.rollback()
        logger.exception(
            "Transaction failed and rolled back (customer=%s): %s",
            sender_customer_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="An error occurred during the transaction")