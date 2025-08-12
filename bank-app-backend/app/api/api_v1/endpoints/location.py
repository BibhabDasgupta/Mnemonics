# --- File: bank-app-backend/app/api/api_v1/endpoints/location.py ---
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

from app.db.base import get_db
from app.services.location_service import LocationService

router = APIRouter()

class LocationValidationRequest(BaseModel):
    """Request model for location validation."""
    customer_unique_id: uuid.UUID
    session_id: str
    latitude: Optional[float] = Field(None, description="GPS latitude")
    longitude: Optional[float] = Field(None, description="GPS longitude")

class LocationResponse(BaseModel):
    """Response model for location operations."""
    success: bool
    is_suspicious: bool
    message: str
    location: Optional[dict] = None
    distance_km: Optional[float] = None
    ip_changed: Optional[bool] = None
    action: Optional[str] = None

class LocationHistoryResponse(BaseModel):
    """Response model for location history."""
    success: bool
    locations: List[dict]
    total_count: int

@router.post("/location/validate", response_model=LocationResponse)
async def validate_user_location(
    request_data: LocationValidationRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Validate user's current location against their session baseline.
    Detects potential session hijacking based on IP and location changes.
    """
    print(f"\n🌍 LOCATION VALIDATION for user {request_data.customer_unique_id}")
    
    # Extract IP address from request
    ip_address = request.client.host
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    
    print(f"   Detected IP: {ip_address}")
    
    location_service = LocationService(db)
    
    # Prepare GPS coordinates if provided
    gps_coords = None
    if request_data.latitude is not None and request_data.longitude is not None:
        gps_coords = (request_data.latitude, request_data.longitude)
    
    try:
        result = await location_service.validate_location(
            customer_id=request_data.customer_unique_id,
            session_id=request_data.session_id,
            ip_address=ip_address,
            gps_coords=gps_coords
        )
        
        return LocationResponse(**result)
        
    except Exception as e:
        print(f"❌ Location validation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Location validation failed: {str(e)}"
        )

@router.get("/location/history/{customer_id}", response_model=LocationHistoryResponse)
async def get_location_history(
    customer_id: uuid.UUID,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get user's location history for security monitoring.
    """
    print(f"\n📍 LOCATION HISTORY for user {customer_id}")
    
    try:
        location_service = LocationService(db)
        locations = location_service.get_user_location_history(customer_id, limit)
        
        return LocationHistoryResponse(
            success=True,
            locations=locations,
            total_count=len(locations)
        )
        
    except Exception as e:
        print(f"❌ Location history error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get location history: {str(e)}"
        )

@router.post("/location/cleanup")
async def cleanup_old_locations(
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Clean up old location records (admin endpoint).
    """
    print(f"\n🧹 LOCATION CLEANUP - removing records older than {hours} hours")
    
    try:
        location_service = LocationService(db)
        deleted_count = location_service.cleanup_old_sessions(hours)
        
        return {
            "success": True,
            "message": f"Cleaned up {deleted_count} old location records",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        print(f"❌ Location cleanup error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Location cleanup failed: {str(e)}"
        )

@router.get("/location/health")
async def location_service_health(db: Session = Depends(get_db)):
    """
    Check location service health and statistics.
    """
    try:
        from app.services.location_service import UserLocation
        
        # Get some basic statistics
        total_records = db.query(UserLocation).count()
        flagged_records = db.query(UserLocation).filter(UserLocation.is_flagged == True).count()
        unique_users = db.query(UserLocation.customer_unique_id).distinct().count()
        
        return {
            "service_status": "healthy",
            "total_location_records": total_records,
            "flagged_records": flagged_records,
            "unique_users_tracked": unique_users,
            "service_ready": True
        }
        
    except Exception as e:
        print(f"❌ Location health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )