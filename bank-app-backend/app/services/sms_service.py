# Enhanced SMS Service with additional notification types
# from twilio.rest import Client
# from sqlalchemy.orm import Session
# from app.core.config import settings
# from app.db.models.user import AppData
# import logging
# from datetime import datetime
# from typing import Optional, Dict, Any
# from decimal import Decimal

# logger = logging.getLogger(__name__)

# class SMSService:
    
#     @staticmethod
#     def send_login_notification(
#         db: Session,
#         customer_id: str,
#         success: bool,
#         device_info: str,
#         location: str,
#         ip_address: str,
#         attempts_left: Optional[int] = None,
#         failure_reason: Optional[str] = None
#     ) -> bool:
#         """Send SMS notification for login attempt (success or failure)"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             if success:
#                 message = (
#                     f"SECURITY ALERT: Successful login to your DhanRakshak App\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n"
#                     f"Location: {location}\n"
#                     f"IP: {ip_address}\n\n"
#                     f"If this wasn't you, please contact support immediately."
#                 )
#             else:
#                 base_message = (
#                     f"SECURITY ALERT: Failed login attempt to your DhanRakshak App\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n"
#                     f"Location: {location}\n"
#                     f"IP: {ip_address}"
#                 )
                
#                 if failure_reason:
#                     base_message += f"\nReason: {failure_reason}"
                
#                 if attempts_left is not None:
#                     if attempts_left > 0:
#                         base_message += f"\n\nAttempts remaining: {attempts_left}"
#                     else:
#                         base_message += (
#                             f"\n\nAccount temporarily locked due to multiple failed attempts. "
#                             f"Choose: 1) Restore app or 2) Wait 15 hours to try again."
#                         )
                
#                 base_message += "\n\nIf this wasn't you, please contact support immediately."
#                 message = base_message

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send login SMS notification: {str(e)}")
#             return False

#     @staticmethod 
#     def send_account_locked_notification(db: Session, customer_id: str, device_info: str) -> bool:
#         """Send SMS when account gets locked after failed attempts"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             message = (
#                 f"SECURITY ALERT: Your DhanRakshak App account has been temporarily locked\n"
#                 f"Time: {timestamp}\n"
#                 f"Device: {device_info}\n\n"
#                 f"Reason: 5 consecutive failed login attempts\n\n"
#                 f"Options:\n"
#                 f"1. Restore your app (clears device data)\n"
#                 f"2. Wait 15 hours before trying again\n\n"
#                 f"Contact support if you need assistance."
#             )

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send account locked SMS: {str(e)}")
#             return False

#     # @staticmethod
#     # def send_transaction_notification(
#     #     db: Session,
#     #     customer_id: str,
#     #     amount: Decimal,
#     #     recipient_account: str,
#     #     recipient_name: str,
#     #     new_balance: Decimal,
#     #     transaction_id: Optional[str] = None,
#     #     device_info: Optional[str] = None,
#     #     location: Optional[str] = None
#     # ) -> bool:
#     #     """Send SMS notification for successful transaction"""
#     #     try:
#     #         app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#     #         if not app_data or not app_data.phone_number:
#     #             logger.error(f"No phone number found for customer {customer_id}")
#     #             return False

#     #         phone_number = app_data.phone_number
#     #         timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#     #         message = (
#     #             f"TRANSACTION ALERT: Money Transfer Successful\n"
#     #             f"Amount: ₹{amount}\n"
#     #             f"To: {recipient_name}\n"
#     #             f"Account: ***{recipient_account[-4:]}\n"
#     #             f"Time: {timestamp}\n"
#     #             f"New Balance: ₹{new_balance}\n"
#     #         )
            
#     #         if transaction_id:
#     #             message += f"Ref ID: {transaction_id}\n"
            
#     #         if device_info:
#     #             message += f"Device: {device_info}\n"
                
#     #         if location:
#     #             message += f"Location: {location}\n"
                
#     #         message += f"\nIf this transaction wasn't authorized by you, please contact support immediately."

#     #         return SMSService._send_sms(phone_number, message)
            
#     #     except Exception as e:
#     #         logger.error(f"Failed to send transaction SMS notification: {str(e)}")
#     #         return False

#     @staticmethod
#     def send_registration_notification(
#         db: Session,
#         customer_id: str,
#         device_info: str,
#         location: str,
#         ip_address: str
#     ) -> bool:
#         """Send SMS notification for successful app registration"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             message = (
#                 f"REGISTRATION ALERT: DhanRakshak App Successfully Registered\n"
#                 f"Time: {timestamp}\n"
#                 f"Device: {device_info}\n"
#                 f"Location: {location}\n"
#                 f"IP: {ip_address}\n\n"
#                 f"Your mobile banking app has been successfully set up with biometric security.\n\n"
#                 f"If this wasn't done by you, please contact support immediately and visit your nearest branch."
#             )

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send registration SMS notification: {str(e)}")
#             return False

#     @staticmethod
#     def send_restoration_notification(
#         db: Session,
#         customer_id: str,
#         device_info: str,
#         location: str,
#         ip_address: str,
#         restoration_limits_info: Optional[Dict] = None
#     ) -> bool:
#         """Send SMS notification for successful app restoration"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             message = (
#                 f"RESTORATION ALERT: DhanRakshak App Successfully Restored\n"
#                 f"Time: {timestamp}\n"
#                 f"Device: {device_info}\n"
#                 f"Location: {location}\n"
#                 f"IP: {ip_address}\n\n"
#                 f"Your mobile banking app has been restored with new biometric security.\n"
#             )
            
#             if restoration_limits_info and restoration_limits_info.get("activated"):
#                 message += (
#                     f"\nSECURITY NOTICE: Post-restoration limits active\n"
#                     f"Transaction Limit: ₹{restoration_limits_info.get('limit_amount', 5000)} per transaction\n"
#                     f"Duration: {restoration_limits_info.get('duration_hours', 35)} hours\n"
#                 )
            
#             message += f"\nIf this restoration wasn't done by you, please contact support immediately."

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send restoration SMS notification: {str(e)}")
#             return False

#     @staticmethod
#     def send_seedkey_attempt_notification(
#         db: Session,
#         customer_id: str,
#         attempts_remaining: int,
#         device_info: str,
#         is_final_attempt: bool = False
#     ) -> bool:
#         """Send SMS notification for failed seedkey verification attempts"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             if is_final_attempt:
#                 message = (
#                     f"SECURITY ALERT: Seed Key Verification Failed - Account Locked\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n\n"
#                     f"Reason: 3 incorrect seed phrase attempts\n\n"
#                     f"Your app restoration has been blocked for 24 hours.\n"
#                     f"After 24 hours, you can try restoration again.\n\n"
#                     f"If this wasn't you, please contact support immediately."
#                 )
#             else:
#                 message = (
#                     f"SECURITY ALERT: Incorrect Seed Phrase - App Restoration\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n\n"
#                     f"Incorrect seed phrase entered during app restoration.\n"
#                     f"Attempts remaining: {attempts_remaining}\n\n"
#                     f"If this wasn't you, please contact support immediately."
#                 )

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send seedkey attempt SMS notification: {str(e)}")
#             return False

#     @staticmethod
#     def send_revocation_notification(
#         db: Session,
#         customer_id: str,
#         device_info: str,
#         location: str
#     ) -> bool:
#         """Send SMS notification for app access revocation"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             message = (
#                 f"REVOCATION ALERT: DhanRakshak App Access Revoked\n"
#                 f"Time: {timestamp}\n"
#                 f"Device: {device_info}\n"
#                 f"Location: {location}\n\n"
#                 f"Your mobile banking app access has been revoked as requested.\n"
#                 f"All app data has been cleared from your device.\n\n"
#                 f"To restore access, please visit your nearest branch with valid ID.\n\n"
#                 f"If this wasn't done by you, please contact support immediately."
#             )

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send revocation SMS notification: {str(e)}")
#             return False

#     @staticmethod
#     def send_anomaly_detection_notification(
#         db: Session,
#         customer_id: str,
#         anomaly_type: str,
#         details: str,
#         device_info: Optional[str] = None,
#         location: Optional[str] = None
#     ) -> bool:
#         """Send SMS notification for anomaly detection"""
#         try:
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             message = (
#                 f"SECURITY ALERT: Unusual Activity Detected\n"
#                 f"Type: {anomaly_type}\n"
#                 f"Time: {timestamp}\n"
#             )
            
#             if device_info:
#                 message += f"Device: {device_info}\n"
#             if location:
#                 message += f"Location: {location}\n"
                
#             message += (
#                 f"\nDetails: {details}\n\n"
#                 f"If this activity wasn't authorized by you, please:\n"
#                 f"1. Change your banking passwords immediately\n"
#                 f"2. Contact support\n"
#                 f"3. Visit your nearest branch if needed"
#             )

#             return SMSService._send_sms(phone_number, message)
            
#         except Exception as e:
#             logger.error(f"Failed to send anomaly detection SMS notification: {str(e)}")
#             return False

#     @staticmethod
#     def _send_sms(phone_number: str, message: str) -> bool:
#         """Internal method to send SMS using Twilio"""
#         try:
#             client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
#             sms = client.messages.create(
#                 body=message,
#                 from_=settings.TWILIO_PHONE_NUMBER,
#                 to=phone_number
#             )
            
#             logger.info(f"SMS sent successfully to {phone_number[:6]}****. SID: {sms.sid}")
#             return True
            
#         except Exception as e:
#             logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
#             return False


# #     # Enhanced SMS Service with detailed logging for debugging
# # @staticmethod
# # def send_transaction_notification(
# #     db: Session,
# #     customer_id: str,
# #     amount: Decimal,
# #     recipient_account: str,
# #     recipient_name: str,
# #     new_balance: Decimal,
# #     transaction_id: Optional[str] = None,
# #     device_info: Optional[str] = None,
# #     location: Optional[str] = None
# # ) -> bool:
# #     """Send SMS notification for successful transaction with enhanced logging"""
# #     try:
# #         logger.info(f"🔔 Starting transaction SMS for customer: {customer_id}")
        
# #         app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
# #         if not app_data:
# #             logger.error(f"❌ Customer not found in database: {customer_id}")
# #             return False
            
# #         if not app_data.phone_number:
# #             logger.error(f"❌ No phone number found for customer {customer_id}")
# #             return False

# #         phone_number = app_data.phone_number
# #         logger.info(f"📱 Found phone number for customer {customer_id}: {phone_number[:3]}****{phone_number[-2:] if len(phone_number) > 5 else '**'}")
        
# #         timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
        
# #         # Build message with better formatting
# #         message = (
# #             f"✅ TRANSACTION COMPLETED\n"
# #             f"Amount: ₹{amount}\n"
# #             f"To: {recipient_name}\n"
# #             f"Account: ***{recipient_account[-4:]}\n"
# #             f"Time: {timestamp}\n"
# #             f"Balance: ₹{new_balance}\n"
# #         )
        
# #         if transaction_id:
# #             message += f"Ref: {transaction_id[:8]}\n"
        
# #         if device_info:
# #             message += f"Device: {device_info}\n"
            
# #         if location:
# #             message += f"Location: {location}\n"
            
# #         message += f"\n⚠️ If unauthorized, contact support immediately."

# #         logger.info(f"📝 SMS message prepared (length: {len(message)}): {message[:100]}...")
        
# #         # Send SMS with enhanced logging
# #         result = SMSService._send_sms_with_retry(phone_number, message)
        
# #         if result:
# #             logger.info(f"✅ Transaction SMS sent successfully for customer {customer_id}")
# #         else:
# #             logger.error(f"❌ Transaction SMS failed for customer {customer_id}")
        
# #         return result
        
# #     except Exception as e:
# #         logger.exception(f"💥 Transaction SMS notification failed: {str(e)}")
# #         return False

#     @staticmethod
#      def _send_sms_with_retry(phone_number: str, message: str, max_retries: int = 2) -> bool:
#     """Send SMS with retry logic and enhanced logging"""
#     for attempt in range(max_retries + 1):
#         try:
#             logger.info(f"📤 Sending SMS attempt {attempt + 1}/{max_retries + 1} to {phone_number[:6]}****")
            
#             # Validate Twilio configuration
#             if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
#                 raise Exception("Twilio configuration incomplete")
            
#             logger.debug(f"🔧 Twilio config - SID: {settings.TWILIO_ACCOUNT_SID[:10]}..., From: {settings.TWILIO_PHONE_NUMBER}")
            
#             client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
#             # Ensure proper phone number format
#             formatted_number = phone_number
#             if not phone_number.startswith('+'):
#                 if phone_number.startswith('91') and len(phone_number) == 12:
#                     formatted_number = '+' + phone_number
#                 elif len(phone_number) == 10:
#                     formatted_number = '+91' + phone_number
#                 else:
#                     logger.warning(f"⚠️ Unusual phone number format: {phone_number}")
            
#             logger.info(f"📱 Formatted phone number: {formatted_number[:6]}****")
            
#             sms = client.messages.create(
#                 body=message,
#                 from_=settings.TWILIO_PHONE_NUMBER,
#                 to=formatted_number
#             )
            
#             logger.info(f"✅ SMS sent successfully! SID: {sms.sid}, Status: {sms.status}, To: {formatted_number[:6]}****")
            
#             # Check message status
#             if hasattr(sms, 'error_code') and sms.error_code:
#                 logger.error(f"❌ Twilio error code: {sms.error_code}, Message: {sms.error_message}")
#                 return False
            
#             return True
            
#         except Exception as e:
#             logger.error(f"❌ SMS attempt {attempt + 1} failed for {phone_number[:6]}****: {str(e)}")
#             if attempt < max_retries:
#                 logger.info(f"🔄 Retrying SMS send...")
#                 continue
#             else:
#                 logger.error(f"💥 All SMS attempts failed for {phone_number[:6]}****")
#                 return False
    
#     return False










# @staticmethod
# def send_transaction_notification(
#         db: Session,
#         customer_id: str,
#         amount: Decimal,
#         recipient_account: str,
#         recipient_name: str,
#         new_balance: Decimal,
#         transaction_id: Optional[str] = None,
#         device_info: Optional[str] = None,
#         location: Optional[str] = None
#     ) -> bool:
#         """Send SMS notification for successful transaction with enhanced logging"""
#         try:
#             logger.info(f"🔔 Starting transaction SMS for customer: {customer_id}")
            
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data:
#                 logger.error(f"❌ Customer not found in database: {customer_id}")
#                 return False
                
#             if not app_data.phone_number:
#                 logger.error(f"❌ No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             logger.info(f"📱 Found phone number for customer {customer_id}: {phone_number[:3]}****{phone_number[-2:] if len(phone_number) > 5 else '**'}")
            
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             # Build message with better formatting
#             message = (
#                 f"✅ TRANSACTION COMPLETED\n"
#                 f"Amount: ₹{amount}\n"
#                 f"To: {recipient_name}\n"
#                 f"Account: ***{recipient_account[-4:]}\n"
#                 f"Time: {timestamp}\n"
#                 f"Balance: ₹{new_balance}\n"
#             )
            
#             if transaction_id:
#                 message += f"Ref: {transaction_id[:8]}\n"
            
#             if device_info:
#                 message += f"Device: {device_info}\n"
                
#             if location:
#                 message += f"Location: {location}\n"
                
#             message += f"\n⚠️ If unauthorized, contact support immediately."

#             logger.info(f"📝 SMS message prepared (length: {len(message)}): {message[:100]}...")
            
#             # Send SMS with enhanced logging
#             result = SMSService._send_sms_with_retry(phone_number, message)
            
#             if result:
#                 logger.info(f"✅ Transaction SMS sent successfully for customer {customer_id}")
#             else:
#                 logger.error(f"❌ Transaction SMS failed for customer {customer_id}")
            
#             return result
            
#         except Exception as e:
#             logger.exception(f"💥 Transaction SMS notification failed: {str(e)}")
#             return False

# @staticmethod
# def send_seedkey_attempt_notification(
#         db: Session,
#         customer_id: str,
#         attempts_remaining: int,
#         device_info: str,
#         is_final_attempt: bool = False
#     ) -> bool:
#         """Send SMS notification for failed seedkey verification attempts with enhanced handling"""
#         try:
#             logger.info(f"🔔 Starting seedkey attempt SMS for customer: {customer_id}")
            
#             app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
#             if not app_data or not app_data.phone_number:
#                 logger.error(f"❌ No phone number found for customer {customer_id}")
#                 return False

#             phone_number = app_data.phone_number
#             timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
#             if is_final_attempt:
#                 message = (
#                     f"🚨 SECURITY ALERT: Seed Key Verification Failed - Account Locked\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n\n"
#                     f"Reason: 3 incorrect seed phrase attempts\n\n"
#                     f"Your app restoration has been blocked for 24 hours.\n"
#                     f"After 24 hours, you can try restoration again.\n\n"
#                     f"If this wasn't you, please contact support immediately."
#                 )
#             else:
#                 message = (
#                     f"⚠️ SECURITY ALERT: Incorrect Seed Phrase - App Restoration\n"
#                     f"Time: {timestamp}\n"
#                     f"Device: {device_info}\n\n"
#                     f"Incorrect seed phrase entered during app restoration.\n"
#                     f"Attempts remaining: {attempts_remaining}\n\n"
#                     f"If this wasn't you, please contact support immediately."
#                 )

#             logger.info(f"📝 Seedkey SMS message prepared for customer {customer_id}")
#             result = SMSService._send_sms_with_retry(phone_number, message)
            
#             if result:
#                 logger.info(f"✅ Seedkey attempt SMS sent successfully for customer {customer_id}")
#             else:
#                 logger.error(f"❌ Seedkey attempt SMS failed for customer {customer_id}")
                
#             return result
            
#         except Exception as e:
#             logger.exception(f"💥 Seedkey attempt SMS notification failed: {str(e)}")
#             return False

# @staticmethod
# def _send_sms_with_retry(phone_number: str, message: str, max_retries: int = 2) -> bool:
#         """Send SMS with retry logic and enhanced logging"""
#         for attempt in range(max_retries + 1):
#             try:
#                 logger.info(f"📤 Sending SMS attempt {attempt + 1}/{max_retries + 1} to {phone_number[:6]}****")
                
#                 # Validate Twilio configuration
#                 if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
#                     logger.error("❌ Twilio configuration incomplete")
#                     raise Exception("Twilio configuration incomplete")
                
#                 logger.debug(f"🔧 Twilio config - SID: {settings.TWILIO_ACCOUNT_SID[:10]}..., From: {settings.TWILIO_PHONE_NUMBER}")
                
#                 client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                
#                 # Ensure proper phone number format
#                 formatted_number = phone_number
#                 if not phone_number.startswith('+'):
#                     if phone_number.startswith('91') and len(phone_number) == 12:
#                         formatted_number = '+' + phone_number
#                     elif len(phone_number) == 10:
#                         formatted_number = '+91' + phone_number
#                     else:
#                         logger.warning(f"⚠️ Unusual phone number format: {phone_number}")
                
#                 logger.info(f"📱 Formatted phone number: {formatted_number[:6]}****")
                
#                 sms = client.messages.create(
#                     body=message,
#                     from_=settings.TWILIO_PHONE_NUMBER,
#                     to=formatted_number
#                 )
                
#                 logger.info(f"✅ SMS sent successfully! SID: {sms.sid}, Status: {sms.status}, To: {formatted_number[:6]}****")
                
#                 # Check message status
#                 if hasattr(sms, 'error_code') and sms.error_code:
#                     logger.error(f"❌ Twilio error code: {sms.error_code}, Message: {sms.error_message}")
#                     return False
                
#                 return True
                
#             except Exception as e:
#                 logger.error(f"❌ SMS attempt {attempt + 1} failed for {phone_number[:6]}****: {str(e)}")
#                 if attempt < max_retries:
#                     logger.info(f"🔄 Retrying SMS send...")
#                     continue
#                 else:
#                     logger.error(f"💥 All SMS attempts failed for {phone_number[:6]}****")
#                     return False
        
#         return False

#     # Keep all other existing methods like send_registration_notification, etc.
# @staticmethod
# def _send_sms(phone_number: str, message: str) -> bool:
#         """Internal method to send SMS using Twilio - DEPRECATED, use _send_sms_with_retry instead"""
#         return SMSService._send_sms_with_retry(phone_number, message)
















# Enhanced SMS Service with fixed notifications - COMPLETE FILE
from twilio.rest import Client
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models.user import AppData
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal

logger = logging.getLogger(__name__)

class SMSService:
    
    @staticmethod
    def send_login_notification(
        db: Session,
        customer_id: str,
        success: bool,
        device_info: str,
        location: str,
        ip_address: str,
        attempts_left: Optional[int] = None,
        failure_reason: Optional[str] = None
    ) -> bool:
        """Send SMS notification for login attempt (success or failure)"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            if success:
                message = (
                    f"SECURITY ALERT: Successful login to your DhanRakshak App\n"
                    f"Time: {timestamp}\n"
                    f"Device: {device_info}\n"
                    f"Location: {location}\n"
                    f"IP: {ip_address}\n\n"
                    f"If this wasn't you, please contact support immediately."
                )
            else:
                base_message = (
                    f"SECURITY ALERT: Failed login attempt to your DhanRakshak App\n"
                    f"Time: {timestamp}\n"
                    f"Device: {device_info}\n"
                    f"Location: {location}\n"
                    f"IP: {ip_address}"
                )
                
                if failure_reason:
                    base_message += f"\nReason: {failure_reason}"
                
                if attempts_left is not None:
                    if attempts_left > 0:
                        base_message += f"\n\nAttempts remaining: {attempts_left}"
                    else:
                        base_message += (
                            f"\n\nAccount temporarily locked due to multiple failed attempts. "
                            f"Choose: 1) Restore app or 2) Wait 15 hours to try again."
                        )
                
                base_message += "\n\nIf this wasn't you, please contact support immediately."
                message = base_message

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send login SMS notification: {str(e)}")
            return False

    @staticmethod 
    def send_account_locked_notification(db: Session, customer_id: str, device_info: str) -> bool:
        """Send SMS when account gets locked after failed attempts"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            message = (
                f"SECURITY ALERT: Your DhanRakshak App account has been temporarily locked\n"
                f"Time: {timestamp}\n"
                f"Device: {device_info}\n\n"
                f"Reason: 5 consecutive failed login attempts\n\n"
                f"Options:\n"
                f"1. Restore your app (clears device data)\n"
                f"2. Wait 15 hours before trying again\n\n"
                f"Contact support if you need assistance."
            )

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send account locked SMS: {str(e)}")
            return False

    @staticmethod
    def send_transaction_notification(
        db: Session,
        customer_id: str,
        amount: Decimal,
        recipient_account: str,
        recipient_name: str,
        new_balance: Decimal,
        transaction_id: Optional[str] = None,
        device_info: Optional[str] = None,
        location: Optional[str] = None
    ) -> bool:
        """Send SMS notification for successful transaction with enhanced logging"""
        try:
            logger.info(f"Starting transaction SMS for customer: {customer_id}")
            
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data:
                logger.error(f"Customer not found in database: {customer_id}")
                return False
                
            if not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            logger.info(f"Found phone number for customer {customer_id}: {phone_number[:3]}****{phone_number[-2:] if len(phone_number) > 5 else '**'}")
            
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            # Build message with better formatting
            message = (
                f"TRANSACTION COMPLETED\n"
                f"Amount: ₹{amount}\n"
                f"To: {recipient_name}\n"
                f"Account: ***{recipient_account[-4:]}\n"
                f"Time: {timestamp}\n"
                f"Balance: ₹{new_balance}\n"
            )
            
            if transaction_id:
                message += f"Ref: {transaction_id[:8]}\n"
            
            if device_info:
                message += f"Device: {device_info}\n"
                
            if location:
                message += f"Location: {location}\n"
                
            message += f"\nIf unauthorized, contact support immediately."

            logger.info(f"SMS message prepared (length: {len(message)}): {message[:100]}...")
            
            # Send SMS with enhanced logging
            result = SMSService._send_sms_with_retry(phone_number, message)
            
            if result:
                logger.info(f"Transaction SMS sent successfully for customer {customer_id}")
            else:
                logger.error(f"Transaction SMS failed for customer {customer_id}")
            
            return result
            
        except Exception as e:
            logger.exception(f"Transaction SMS notification failed: {str(e)}")
            return False

    @staticmethod
    def send_registration_notification(
        db: Session,
        customer_id: str,
        device_info: str,
        location: str,
        ip_address: str
    ) -> bool:
        """Send SMS notification for successful app registration"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            message = (
                f"REGISTRATION ALERT: DhanRakshak App Successfully Registered\n"
                f"Time: {timestamp}\n"
                f"Device: {device_info}\n"
                f"Location: {location}\n"
                f"IP: {ip_address}\n\n"
                f"Your mobile banking app has been successfully set up with biometric security.\n\n"
                f"If this wasn't done by you, please contact support immediately and visit your nearest branch."
            )

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send registration SMS notification: {str(e)}")
            return False

    @staticmethod
    def send_restoration_notification(
        db: Session,
        customer_id: str,
        device_info: str,
        location: str,
        ip_address: str,
        restoration_limits_info: Optional[Dict] = None
    ) -> bool:
        """Send SMS notification for successful app restoration"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            message = (
                f"RESTORATION ALERT: DhanRakshak App Successfully Restored\n"
                f"Time: {timestamp}\n"
                f"Device: {device_info}\n"
                f"Location: {location}\n"
                f"IP: {ip_address}\n\n"
                f"Your mobile banking app has been restored with new biometric security.\n"
            )
            
            if restoration_limits_info and restoration_limits_info.get("activated"):
                message += (
                    f"\nSECURITY NOTICE: Post-restoration limits active\n"
                    f"Transaction Limit: ₹{restoration_limits_info.get('limit_amount', 5000)} per transaction\n"
                    f"Duration: {restoration_limits_info.get('duration_hours', 35)} hours\n"
                )
            
            message += f"\nIf this restoration wasn't done by you, please contact support immediately."

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send restoration SMS notification: {str(e)}")
            return False

    @staticmethod
    def send_seedkey_attempt_notification(
        db: Session,
        customer_id: str,
        attempts_remaining: int,
        device_info: str,
        is_final_attempt: bool = False
    ) -> bool:
        """Send SMS notification for failed seedkey verification attempts"""
        try:
            logger.info(f"Starting seedkey attempt SMS for customer: {customer_id}")
            
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            if is_final_attempt:
                message = (
                    f"SECURITY ALERT: Seed Key Verification Failed - Account Locked\n"
                    f"Time: {timestamp}\n"
                    f"Device: {device_info}\n\n"
                    f"Reason: 3 incorrect seed phrase attempts\n\n"
                    f"Your app restoration has been blocked for 24 hours.\n"
                    f"After 24 hours, you can try restoration again.\n\n"
                    f"If this wasn't you, please contact support immediately."
                )
            else:
                message = (
                    f"SECURITY ALERT: Incorrect Seed Phrase - App Restoration\n"
                    f"Time: {timestamp}\n"
                    f"Device: {device_info}\n\n"
                    f"Incorrect seed phrase entered during app restoration.\n"
                    f"Attempts remaining: {attempts_remaining}\n\n"
                    f"If this wasn't you, please contact support immediately."
                )

            logger.info(f"Seedkey SMS message prepared for customer {customer_id}")
            result = SMSService._send_sms_with_retry(phone_number, message)
            
            if result:
                logger.info(f"Seedkey attempt SMS sent successfully for customer {customer_id}")
            else:
                logger.error(f"Seedkey attempt SMS failed for customer {customer_id}")
                
            return result
            
        except Exception as e:
            logger.exception(f"Seedkey attempt SMS notification failed: {str(e)}")
            return False

    @staticmethod
    def send_revocation_notification(
        db: Session,
        customer_id: str,
        device_info: str,
        location: str
    ) -> bool:
        """Send SMS notification for app access revocation"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            message = (
                f"REVOCATION ALERT: DhanRakshak App Access Revoked\n"
                f"Time: {timestamp}\n"
                f"Device: {device_info}\n"
                f"Location: {location}\n\n"
                f"Your mobile banking app access has been revoked as requested.\n"
                f"All app data has been cleared from your device.\n\n"
                f"To restore access, please visit your nearest branch with valid ID.\n\n"
                f"If this wasn't done by you, please contact support immediately."
            )

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send revocation SMS notification: {str(e)}")
            return False

    @staticmethod
    def send_anomaly_detection_notification(
        db: Session,
        customer_id: str,
        anomaly_type: str,
        details: str,
        device_info: Optional[str] = None,
        location: Optional[str] = None
    ) -> bool:
        """Send SMS notification for anomaly detection"""
        try:
            app_data = db.query(AppData).filter(AppData.customer_id == customer_id).first()
            if not app_data or not app_data.phone_number:
                logger.error(f"No phone number found for customer {customer_id}")
                return False

            phone_number = app_data.phone_number
            timestamp = datetime.now().strftime("%d-%m-%Y %I:%M %p IST")
            
            message = (
                f"SECURITY ALERT: Unusual Activity Detected\n"
                f"Type: {anomaly_type}\n"
                f"Time: {timestamp}\n"
            )
            
            if device_info:
                message += f"Device: {device_info}\n"
            if location:
                message += f"Location: {location}\n"
                
            message += (
                f"\nDetails: {details}\n\n"
                f"If this activity wasn't authorized by you, please:\n"
                f"1. Change your banking passwords immediately\n"
                f"2. Contact support\n"
                f"3. Visit your nearest branch if needed"
            )

            return SMSService._send_sms_with_retry(phone_number, message)
            
        except Exception as e:
            logger.error(f"Failed to send anomaly detection SMS notification: {str(e)}")
            return False

    @staticmethod
    def _send_sms_with_retry(phone_number: str, message: str, max_retries: int = 2) -> bool:
        """Send SMS with retry logic and enhanced logging"""
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Sending SMS attempt {attempt + 1}/{max_retries + 1} to {phone_number[:6]}****")
                
                # Validate Twilio configuration
                if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
                    logger.error("Twilio configuration incomplete")
                    raise Exception("Twilio configuration incomplete")
                
                logger.debug(f"Twilio config - SID: {settings.TWILIO_ACCOUNT_SID[:10]}..., From: {settings.TWILIO_PHONE_NUMBER}")
                
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                
                # Ensure proper phone number format
                formatted_number = phone_number
                if not phone_number.startswith('+'):
                    if phone_number.startswith('91') and len(phone_number) == 12:
                        formatted_number = '+' + phone_number
                    elif len(phone_number) == 10:
                        formatted_number = '+91' + phone_number
                    else:
                        logger.warning(f"Unusual phone number format: {phone_number}")
                
                logger.info(f"Formatted phone number: {formatted_number[:6]}****")
                
                sms = client.messages.create(
                    body=message,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=formatted_number
                )
                
                logger.info(f"SMS sent successfully! SID: {sms.sid}, Status: {sms.status}, To: {formatted_number[:6]}****")
                
                # Check message status
                if hasattr(sms, 'error_code') and sms.error_code:
                    logger.error(f"Twilio error code: {sms.error_code}, Message: {sms.error_message}")
                    return False
                
                return True
                
            except Exception as e:
                logger.error(f"SMS attempt {attempt + 1} failed for {phone_number[:6]}****: {str(e)}")
                if attempt < max_retries:
                    logger.info(f"Retrying SMS send...")
                    continue
                else:
                    logger.error(f"All SMS attempts failed for {phone_number[:6]}****")
                    return False
        
        return False

    @staticmethod
    def _send_sms(phone_number: str, message: str) -> bool:
        """DEPRECATED: Use _send_sms_with_retry instead"""
        return SMSService._send_sms_with_retry(phone_number, message)