# from sqlalchemy.orm import Session
# from app.db.models.user import Passkey, Seedkey
# from app.schemas.user import CustomerCreate
# from app.services import seedkey_service
# from datetime import datetime
# import pytz

# def get_customer_by_id(db: Session, customer_id: str) -> Customer | None:
#     return db.query(Customer).filter(Customer.customer_id == customer_id).first()

# def get_customer_by_email(db: Session, email: str) -> Customer | None:
#     return db.query(Customer).filter(Customer.email == email).first()

# def get_customer_by_aadhaar(db: Session, aadhaar: str) -> Customer | None:
#     return db.query(Customer).filter(Customer.aadhaar_number == aadhaar).first()

# def create_customer(db: Session, customer_in: CustomerCreate) -> Customer:
#     db_customer = Customer(**customer_in.dict())
#     db.add(db_customer)
#     db.commit()
#     db.refresh(db_customer)
#     return db_customer
    
# def create_customer_with_seedkey(db: Session, customer_in: CustomerCreate, public_key: str) -> Customer:
#     # Create the customer first
#     db_customer = Customer(**customer_in.dict(), is_registered_in_app=True)
#     db.add(db_customer)
#     db.flush()  # Use flush to assign a customer_id without committing the transaction

#     # Create the seedkey
#     seedkey_service.create_seedkey_for_customer(
#         db=db, customer_id=db_customer.customer_id, public_key=public_key
#     )

#     db.commit()
#     db.refresh(db_customer)
#     return db_customer

# def add_passkey_to_customer(db: Session, customer: Customer, credential_id: bytes, public_key: bytes, sign_count: int) -> Passkey:
#     db_passkey = Passkey(
#         customer_id=customer.customer_id,
#         credential_id=credential_id,
#         public_key=public_key,
#         sign_count=sign_count
#     )
#     db.add(db_passkey)
#     # Also update the customer's registration status
#     customer.is_registered_in_app = True
#     db.commit()
#     db.refresh(db_passkey)
#     return db_passkey

# # New function to get a specific passkey
# def get_passkey_by_credential_id(db: Session, credential_id: bytes) -> Passkey | None:
#     return db.query(Passkey).filter(Passkey.credential_id == credential_id).first()

# def get_customer_passkeys(db: Session, customer: Customer) -> list[Passkey]:
#     return db.query(Passkey).filter(Passkey.customer_id == customer.customer_id).all()

# def update_passkey_sign_count(db: Session, credential_id: bytes, new_count: int) -> Passkey | None:
#     passkey = db.query(Passkey).filter(Passkey.credential_id == credential_id).first()
#     if passkey:
#         passkey.sign_count = new_count
#         db.commit()
#         db.refresh(passkey)
#     return passkey

# def update_customer_login_meta(db: Session, customer_id: str) -> Customer | None:
#     """
#     Updates the login metadata for a customer's seedkey upon successful login.
#     """
#     customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
#     if customer and customer.seedkey:
#         seedkey = customer.seedkey
#         seedkey.last_loggedInTime = datetime.now(pytz.utc)
        
#         # Increment the number of logged-in devices
#         if seedkey.no_of_logged_in_devices is None:
#             seedkey.no_of_logged_in_devices = 0
#         seedkey.no_of_logged_in_devices += 1
        
#         # Placeholder for IP and Location. In a real app, you would get this
#         # from the request headers.
#         seedkey.last_loggedInIP = "127.0.0.1"
#         seedkey.last_loggedInLocation = "Localhost"

#         db.commit()
#         db.refresh(customer)
#     return customer