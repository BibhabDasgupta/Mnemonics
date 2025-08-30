from sqlalchemy.orm import Session
from app.db.models.user import Account, Transaction
from typing import List, Optional
import random
from datetime import datetime, timedelta

def create_account_for_customer(db: Session, customer_id: str, account_type: str = "Savings") -> Account:
    """Creates a new account for a customer."""
    account_number = f"ACC{random.randint(100000000, 999999999)}"
    initial_balance = random.uniform(500.0, 5000.0)

    db_account = Account(
        customer_id=customer_id,
        account_number=account_number,
        balance=initial_balance,
        account_type=account_type
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def get_accounts_by_customer_id(db: Session, customer_id: str) -> List[Account]:
    """
    Retrieves ALL accounts for a given customer.
    This should return multiple accounts if they exist.
    """
    accounts = db.query(Account).filter(Account.customer_id == customer_id).all()
    print(f"Database query returned {len(accounts)} accounts for customer_id: {customer_id}")
    return accounts

def get_account_by_number(db: Session, account_number: str) -> Optional[Account]:
    """Retrieves a specific account by account number."""
    return db.query(Account).filter(Account.account_number == account_number).first()

def get_transactions_by_account_number(db: Session, account_number: str) -> List[Transaction]:
    """Retrieves all transactions for a given account, most recent first."""
    return db.query(Transaction).filter(Transaction.account_number == account_number).order_by(Transaction.date.desc()).all()

def seed_dummy_transactions(db: Session, account_number: str, count: int = 10):
    """Creates random dummy transactions for an account."""
    dummy_descriptions = [
        ("UPI to Zomato", "debit"), ("Salary Credit", "credit"),
        ("ATM Withdrawal", "debit"), ("Netflix Subscription", "debit"),
        ("Rent Payment", "debit"), ("Interest Credit", "credit"),
        ("Electricity Bill", "debit"), ("Mobile Recharge", "debit"),
        ("Online Shopping", "debit"), ("Dividend Credit", "credit"),
        ("Insurance Premium", "debit"), ("Refund Credit", "credit")
    ]
    
    for i in range(count):
        desc, type = random.choice(dummy_descriptions)
        amount = random.uniform(50.0, 2500.0) if type == 'debit' else random.uniform(1000.0, 50000.0)
        date = datetime.utcnow() - timedelta(days=random.randint(1, 30))

        db_transaction = Transaction(
            account_number=account_number,
            description=desc,
            amount=amount,
            type=type,
            date=date,
            terminal_id=f"terminal_{random.randint(1000, 9999)}"
        )
        db.add(db_transaction)
    
    db.commit()

def create_multiple_accounts_for_customer(db: Session, customer_id: str) -> List[Account]:
    """
    Helper function to create multiple accounts for testing purposes.
    You can call this to set up test data.
    """
    account_types = ["Savings", "Current", "Fixed Deposit", "Credit Card"]
    accounts = []
    
    for i, acc_type in enumerate(account_types[:2]):  # Create 2 accounts
        account = create_account_for_customer(db, customer_id, acc_type)
        seed_dummy_transactions(db, account.account_number, count=random.randint(5, 15))
        accounts.append(account)
    
    return accounts

def get_account_balance(db: Session, account_number: str) -> Optional[float]:
    """Get the current balance of an account."""
    account = get_account_by_number(db, account_number)
    return account.balance if account else None

def update_account_balance(db: Session, account_number: str, new_balance: float) -> bool:
    """Update the balance of an account."""
    try:
        account = get_account_by_number(db, account_number)
        if account:
            account.balance = new_balance
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        print(f"Error updating account balance: {str(e)}")
        return False