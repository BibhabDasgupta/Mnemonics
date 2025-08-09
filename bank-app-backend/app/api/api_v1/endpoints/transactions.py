# --- File: app/api/api_v1/endpoints/transactions.py ---

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import jwt
from typing import Annotated
import logging
from decimal import Decimal # MODIFIED: Import the Decimal type

from app.db.base import get_db
from app.db.models.user import Account, Transaction, AppData
from app.schemas.transaction import TransactionCreateRequest
from app.services import feature_service
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_current_customer(authorization: Annotated[str, Header()], db: Session = Depends(get_db)):
    """
    Dependency to get the current customer from the JWT in the Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        customer_id = payload.get("sub")
        if customer_id is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials, sub missing")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    customer = db.query(AppData).filter(AppData.customer_id == customer_id).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer


@router.post("/transactions/create")
def create_transaction(
    request: TransactionCreateRequest,
    background_tasks: BackgroundTasks,
    current_customer: AppData = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Executes a financial transaction and triggers background tasks to update fraud features.
    """
    sender_customer_id = current_customer.customer_id
    
    # MODIFIED: Convert the incoming float amount to a Decimal for precise calculations
    transaction_amount = Decimal(request.amount)

    # --- Pre-Transaction Checks ---
    sender_account = db.query(Account).filter(Account.customer_id == sender_customer_id).first()
    recipient_account = db.query(Account).filter(Account.account_number == request.recipient_account_number).first()

    if not sender_account:
        raise HTTPException(status_code=404, detail="Sender account not found.")
    if not recipient_account:
        raise HTTPException(status_code=404, detail="Recipient account not found.")
    
    if sender_account.account_number == recipient_account.account_number:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account.")
    
    # MODIFIED: Compare Decimal with Decimal for the balance check
    if sender_account.balance < transaction_amount:
        raise HTTPException(status_code=400, detail="Insufficient funds.")

    # --- Atomic Transaction Logic ---
    try:
        # MODIFIED: Perform all calculations using Decimal objects
        sender_account.balance -= transaction_amount
        recipient_account.balance += transaction_amount

        # Create transaction log for the sender (debit)
        db.add(Transaction(
            account_number=sender_account.account_number,
            terminal_id=request.terminal_id,
            description=f"Transfer to {recipient_account.account_number}",
            amount=-transaction_amount,
            type="debit",
            is_fraud=False
        ))
        
        # Create transaction log for the recipient (credit)
        db.add(Transaction(
            account_number=recipient_account.account_number,
            terminal_id=request.terminal_id,
            description=f"Transfer from {sender_account.account_number}",
            amount=transaction_amount,
            type="credit",
            is_fraud=False
        ))
        
        db.commit()

        # Enqueue background tasks to update features
        background_tasks.add_task(feature_service.update_customer_features, db, sender_customer_id)
        background_tasks.add_task(feature_service.update_terminal_features, db, request.terminal_id)

        db.refresh(sender_account)
        return {"status": "Transaction successful", "new_balance": sender_account.balance}

    except Exception as e:
        db.rollback()
        logger.error(f"Transaction failed for sender {sender_customer_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during the transaction.")