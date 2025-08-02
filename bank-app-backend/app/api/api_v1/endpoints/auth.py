# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from app.db.base import get_db
# from app.schemas.user import (
#     PhoneVerificationRequest, 
#     OTPVerificationRequest,
#     CustomerCreate,
#     AppDataCreate
# )
# from app.services import otp_service
# from app.db.models.user import Account, AppData
# from datetime import datetime
# import uuid

# router = APIRouter()

# # In your endpoints/otp.py
# @router.post("/otp/send")
# def send_otp(request: PhoneVerificationRequest, db: Session = Depends(get_db)):
#     try:
#         # Directly decrypt without ephemeral key
#         phone_number = otp_service.decrypt_phone_number(
#             request.encrypted_phone_number
#         )
        
#         # Rest of the function remains exactly the same
#         customer = otp_service.check_phone_number(db, phone_number)
        
#         if customer["status"] == "revoked":
#             raise HTTPException(
#                 status_code=403, 
#                 detail="App access is revoked, please visit a branch for re-registration"
#             )
#         if customer["status"] == "registered":
#             raise HTTPException(
#                 status_code=409, 
#                 detail="Phone number already registered, restore it to continue"
#             )
        
#         otp_service.send_otp(phone_number)
        
#         return {
#             "status": "OTP sent successfully",
#             "phone_number": phone_number,
#             "customer_id": customer["customer_id"]
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail="Internal server error")


# @router.post("/otp/verify")
# def verify_otp(request: OTPVerificationRequest, db: Session = Depends(get_db)):
#     try:
#         # Directly decrypt without ephemeral key
#         phone_number = otp_service.decrypt_phone_number(
#             request.encrypted_phone_number
#         )
        
#         # Rest of the function remains exactly the same
#         customer = otp_service.check_phone_number(db, phone_number)
        
#         if customer["status"] == "revoked":
#             raise HTTPException(
#                 status_code=403, 
#                 detail="App access is revoked, please visit a branch for re-registration"
#             )
#         if customer["status"] == "registered":
#             raise HTTPException(
#                 status_code=409, 
#                 detail="Phone number already registered, restore it to continue"
#             )
        
#         if not otp_service.verify_otp(phone_number, request.otp_code):
#             raise HTTPException(status_code=400, detail="Invalid OTP")
        
#         customer_id = customer["customer_id"] or str(uuid.uuid4())
        
#         return {
#             "status": "OTP verified successfully", 
#             "phone_number": phone_number,
#             "customer_id": customer_id
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail="Internal server error")
    



# @router.post("/complete")
# async def complete_registration(customer_data: CustomerCreate, db: Session = Depends(get_db)):
#     """
#     Endpoint to complete registration after OTP verification
#     """
#     try:
#         # Check if customer already exists in accounts table
#         query = text("""
#             SELECT customer_unique_id 
#             FROM accounts 
#             WHERE phone_number = :phone_number
#         """)
#         result = db.execute(query, {"phone_number": customer_data.phone_number}).fetchone()
        
#         if not result:
#             raise HTTPException(status_code=404, detail="Phone number not found in accounts")
        
#         # Update accounts table to mark as registered in app
#         update_query = text("""
#             UPDATE accounts 
#             SET is_registeredinapp = TRUE 
#             WHERE phone_number = :phone_number
#         """)
#         db.execute(update_query, {"phone_number": customer_data.phone_number})
        
#         # Create app_data record
#         app_data = AppData(
#             customer_id=customer_data.customer_id,
#             name=customer_data.name,
#             phone_number=customer_data.phone_number,
#             email=customer_data.email,
#             aadhaar_number=customer_data.aadhaar_number,
#             date_of_birth=customer_data.date_of_birth,
#             app_access_revoked=False,
#             created_at=datetime.utcnow(),
#             updated_at=datetime.utcnow()
#         )
        
#         db.add(app_data)
#         db.commit()
        
#         return {"status": "Registration completed successfully"}
        
#     except Exception as e:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")