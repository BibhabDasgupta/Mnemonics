# --- File: bank-app-backend/main.py ---
from fastapi import FastAPI, Request
import uvicorn 
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base, engine

# Import all routers
from app.api.api_v1.endpoints import (
    accounts,
    register,
    restore,
    login,
    analytics,
    transactions,
    ml_analytics,
    location,
    app_data
)
# Import all models to ensure tables are created
from app.db.models import user as user_models, challenge as challenge_model, behavior as behavior_model,features as features_model

user_models.Base.metadata.create_all(bind=engine)
challenge_model.Base.metadata.create_all(bind=engine)
behavior_model.Base.metadata.create_all(bind=engine)
features_model.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add to the router includes
app.include_router(location.router, prefix=settings.API_V1_STR, tags=["Location Tracking"])

# Also ensure the UserLocation table is created
from app.services.location_service import UserLocation
UserLocation.metadata.create_all(bind=engine)

# --- THIS IS THE DEFINITIVE DEBUGGING MIDDLEWARE ---
@app.middleware("http")
async def log_every_request(request: Request, call_next):
    """
    This middleware intercepts EVERY request before it hits the endpoint logic.
    It will run and print details for both the OPTIONS and POST requests.
    """
    print("\n=============================================")
    print("======= MIDDLEWARE: REQUEST RECEIVED ========")
    print(f"METHOD: {request.method}")
    print(f"URL: {request.url}")
    print("HEADERS:")
    for name, value in request.headers.items():
        print(f"  {name}: {value}")
    
    response = await call_next(request)
    
    print("======= MIDDLEWARE: RESPONSE SENT ===========")
    print(f"STATUS CODE: {response.status_code}")
    print("=============================================\n")
    return response
# --------------------------------------------------------

# Your CORS middleware must come after the logger if you want to see both.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", summary="Health Check")
def read_root():
    return {"status": "Backend is running"}

# Include all API routers
# app.include_router(seedkey_auth.router, prefix=settings.API_V1_STR, tags=["Seedkey Authentication"])
app.include_router(accounts.router, prefix=settings.API_V1_STR, tags=["Bank Accounts"])
app.include_router(register.router, prefix=settings.API_V1_STR, tags=["Registration"])
app.include_router(login.router, prefix=settings.API_V1_STR, tags=["Login"])
app.include_router(restore.router, prefix=settings.API_V1_STR, tags=["Restoration"])
app.include_router(analytics.router, prefix=settings.API_V1_STR, tags=["Behavioral Analytics"])
app.include_router(transactions.router, prefix=settings.API_V1_STR, tags=["Transactions"]) # MODIFIED: Include the new router
app.include_router(ml_analytics.router, prefix=settings.API_V1_STR, tags=["ML Behavioral Analytics"])
app.include_router(app_data.router, prefix=settings.API_V1_STR, tags=["App Data Management"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)