# --- File: app/api/api_v1/endpoints/accounts.py ---

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.services import account_service

router = APIRouter()

@router.get("/accounts/{customer_id}")
def get_customer_accounts(customer_id: str, db: Session = Depends(get_db)):
    """Fetches all accounts and their recent transactions for a customer."""
    accounts = account_service.get_accounts_by_customer_id(db, customer_id)
    if not accounts:
        # If no accounts exist, create a default one
        account = account_service.create_account_for_customer(db, customer_id)
        # Seed it with some dummy data for a good first-time experience
        account_service.seed_dummy_transactions(db, account.account_number)
        accounts = [account]

    # Structure the response
    response_data = []
    for acc in accounts:
        # MODIFIED: Fetch transactions by account_number
        transactions = account_service.get_transactions_by_account_number(db, acc.account_number)
        response_data.append({
            "account_number": acc.account_number, # MODIFIED: Use account_number as the identifier
            "account_type": acc.account_type,
            "balance": acc.balance,
            "transactions": [t.__dict__ for t in transactions]
        })
    return response_data