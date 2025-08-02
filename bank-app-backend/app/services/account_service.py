# # --- File: app/services/account_service.py ---

# from sqlalchemy.orm import Session
# from app.db.models.user import Account, Transaction, Customer
# import random
# from datetime import datetime, timedelta

# def create_account_for_customer(db: Session, customer_id: str) -> Account:
#     """Creates a default savings account for a new customer."""
#     account_number = f"ACC{random.randint(100000000, 999999999)}"
#     initial_balance = random.uniform(500.0, 5000.0)

#     db_account = Account(
#         customer_id=customer_id,
#         account_number=account_number,
#         balance=initial_balance
#     )
#     db.add(db_account)
#     db.commit()
#     db.refresh(db_account)
#     return db_account

# def get_accounts_by_customer_id(db: Session, customer_id: str) -> list[Account]:
#     """Retrieves all accounts for a given customer."""
#     return db.query(Account).filter(Account.customer_id == customer_id).all()

# def get_transactions_by_account_id(db: Session, account_id: int) -> list[Transaction]:
#     """Retrieves all transactions for a given account, most recent first."""
#     return db.query(Transaction).filter(Transaction.account_id == account_id).order_by(Transaction.date.desc()).all()

# def seed_dummy_transactions(db: Session, account_id: int, count: int = 10):
#     """Creates random dummy transactions for an account."""
#     dummy_descriptions = [
#         ("UPI to Zomato", "debit"), ("Salary Credit", "credit"),
#         ("ATM Withdrawal", "debit"), ("Netflix Subscription", "debit"),
#         ("Rent Payment", "debit"), ("Interest Credit", "credit"),
#         ("Electricity Bill", "debit"), ("Mobile Recharge", "debit")
#     ]
#     for i in range(count):
#         desc, type = random.choice(dummy_descriptions)
#         amount = random.uniform(50.0, 2500.0) if type == 'debit' else random.uniform(20000.0, 50000.0)
#         date = datetime.utcnow() - timedelta(days=random.randint(1, 30))

#         db_transaction = Transaction(
#             account_id=account_id,
#             description=desc,
#             amount=amount,
#             type=type,
#             date=date
#         )
#         db.add(db_transaction)
#     db.commit()