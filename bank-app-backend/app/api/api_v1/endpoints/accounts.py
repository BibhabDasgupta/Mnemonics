# --- File: app/api/api_v1/endpoints/accounts.py ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.services import account_service
from typing import List, Dict, Any

router = APIRouter()

@router.get("/accounts/{customer_id}")
def get_customer_accounts(customer_id: str, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Fetches all accounts and their recent transactions for a customer.
    Returns a list of accounts with their details and transactions.
    """
    try:
        # Get all accounts for the customer
        accounts = account_service.get_accounts_by_customer_id(db, customer_id)
        
        # Debug log
        print(f"Found {len(accounts)} accounts for customer {customer_id}")
        
        if not accounts:
            # Optional: Create a default account if none exists
            # You can uncomment this if you want to auto-create accounts
            # account = account_service.create_account_for_customer(db, customer_id)
            # account_service.seed_dummy_transactions(db, account.account_number)
            # accounts = [account]
            return []

        # Structure the response - include all accounts
        response_data = []
        for acc in accounts:
            # Fetch transactions by account_number
            transactions = account_service.get_transactions_by_account_number(db, acc.account_number)
            
            # Convert transactions to dict format (avoiding SQLAlchemy object serialization issues)
            transaction_list = []
            for t in transactions:
                transaction_list.append({
                    "id": t.id if hasattr(t, 'id') else None,
                    "account_number": t.account_number,
                    "description": t.description,
                    "amount": float(t.amount),  # Ensure it's a float
                    "type": t.type,
                    "date": t.date.isoformat() if t.date else None,
                    "terminal_id": t.terminal_id if hasattr(t, 'terminal_id') else None
                })
            
            account_data = {
                "account_number": acc.account_number,
                "account_type": acc.account_type,
                "balance": float(acc.balance),  # Ensure it's a float
                "customer_id": acc.customer_id,  # Include customer_id for reference
                "transactions": transaction_list
            }
            response_data.append(account_data)
        
        print(f"Returning {len(response_data)} accounts in response")
        return response_data
        
    except Exception as e:
        print(f"Error fetching accounts for customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")


@router.get("/account/{account_number}")
def get_account_details(account_number: str, db: Session = Depends(get_db)):
    """
    Fetches details for a specific account by account number.
    This can be used when a user selects a specific account.
    """
    try:
        account = account_service.get_account_by_number(db, account_number)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        transactions = account_service.get_transactions_by_account_number(db, account_number)
        
        # Convert transactions to dict format
        transaction_list = []
        for t in transactions:
            transaction_list.append({
                "id": t.id if hasattr(t, 'id') else None,
                "account_number": t.account_number,
                "description": t.description,
                "amount": float(t.amount),
                "type": t.type,
                "date": t.date.isoformat() if t.date else None,
                "terminal_id": t.terminal_id if hasattr(t, 'terminal_id') else None
            })
        
        return {
            "account_number": account.account_number,
            "account_type": account.account_type,
            "balance": float(account.balance),
            "customer_id": account.customer_id,
            "transactions": transaction_list
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching account {account_number}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch account details: {str(e)}")





