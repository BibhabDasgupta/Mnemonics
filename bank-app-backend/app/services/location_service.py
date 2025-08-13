# --- File: bank-app-backend/app/services/location_service.py ---
import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from typing import Dict, Optional, Tuple, List
import math

from app.db.base import Base

class UserLocation(Base):
    """Model to store user location data and session tracking."""
    __tablename__ = 'user_locations'

    id = Column(Integer, primary_key=True, index=True)
    customer_unique_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    ip_address = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_source = Column(String, nullable=False)  # 'gps', 'ip', 'manual'
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    is_initial_login = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String, nullable=True)
    created_at = Column(DateTime, server_default='now()')

    def __repr__(self):
        return f"<UserLocation session_id={self.session_id} ip={self.ip_address}>"

class LocationService:
    def __init__(self, db: Session):
        self.db = db
        
    # Security thresholds
    MAX_DISTANCE_KM = 50  # Maximum allowed distance change during session
    MAX_SESSION_DURATION_HOURS = 24  # Auto-expire sessions after 24 hours
    
    async def get_location_from_ip(self, ip_address: str) -> Optional[Dict]:
        """Get location data from IP address using ip-api.com service."""
        if not ip_address or ip_address in ['127.0.0.1', 'localhost']:
            return {
                'latitude': 0.0,
                'longitude': 0.0,
                'city': 'Local',
                'country': 'Local',
                'source': 'ip'
            }
        
        try:
            # Using ip-api.com (free tier: 1000 requests/month)
            response = requests.get(
                f"http://ip-api.com/json/{ip_address}",
                timeout=5
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') == 'success':
                return {
                    'latitude': data.get('lat'),
                    'longitude': data.get('lon'),
                    'city': data.get('city'),
                    'country': data.get('country'),
                    'source': 'ip'
                }
            else:
                print(f"IP API failed for {ip_address}: {data.get('message')}")
                return None
                
        except Exception as e:
            print(f"Error getting location from IP {ip_address}: {e}")
            return None
    
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates using Haversine formula."""
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    async def validate_location(
        self, 
        customer_id: uuid.UUID, 
        session_id: str,
        ip_address: str,
        gps_coords: Optional[Tuple[float, float]] = None
    ) -> Dict[str, any]:
        """Validate user location and detect potential session hijacking."""
        
        print(f"\n🌍 [Location Service] Validating location for user {customer_id}")
        print(f"   Session: {session_id}")
        print(f"   IP: {ip_address}")
        print(f"   GPS: {gps_coords}")
        
        # Determine current location
        current_location = None
        location_source = 'unknown'
        
        if gps_coords:
            current_location = {
                'latitude': gps_coords[0],
                'longitude': gps_coords[1],
                'city': 'GPS Location',
                'country': 'GPS Location',
                'source': 'gps'
            }
            location_source = 'gps'
            print(f"   Using GPS coordinates: {gps_coords}")
        else:
            current_location = await self.get_location_from_ip(ip_address)
            location_source = 'ip'
            print(f"   Using IP-based location: {current_location}")
        
        if not current_location:
            print(f"⚠️  [Location Service] Could not determine location")
            return {
                'success': False,
                'is_suspicious': False,
                'message': 'Could not determine location',
                'location': None
            }
        
        # Check for existing session data
        existing_session = self.db.query(UserLocation).filter(
            UserLocation.customer_unique_id == customer_id,
            UserLocation.session_id == session_id
        ).order_by(UserLocation.created_at.desc()).first()
        
        if not existing_session:
            # First request in session - establish baseline
            print(f"🔒 [Location Service] Establishing location baseline")
            
            location_record = UserLocation(
                customer_unique_id=customer_id,
                session_id=session_id,
                ip_address=ip_address,
                latitude=current_location['latitude'],
                longitude=current_location['longitude'],
                location_source=location_source,
                city=current_location['city'],
                country=current_location['country'],
                is_initial_login=True,
                is_flagged=False
            )
            
            self.db.add(location_record)
            self.db.commit()
            
            return {
                'success': True,
                'is_suspicious': False,
                'message': 'Location baseline established',
                'location': current_location,
                'action': 'baseline_set'
            }
        
        # Compare with baseline location
        initial_lat = existing_session.latitude
        initial_lon = existing_session.longitude
        initial_ip = existing_session.ip_address
        
        print(f"📍 [Location Service] Comparing locations:")
        print(f"   Initial: {initial_lat}, {initial_lon} (IP: {initial_ip})")
        print(f"   Current: {current_location['latitude']}, {current_location['longitude']} (IP: {ip_address})")
        
        # Check for IP change
        ip_changed = ip_address != initial_ip
        
        # Check for location change
        distance_km = 0
        if initial_lat and initial_lon and current_location['latitude'] and current_location['longitude']:
            distance_km = self.calculate_distance(
                initial_lat, initial_lon,
                current_location['latitude'], current_location['longitude']
            )
        
        print(f"   Distance: {distance_km:.2f} km")
        print(f"   IP Changed: {ip_changed}")
        
        # Determine if suspicious
        is_suspicious = False
        flag_reason = None
        action = 'verified'
        
        if ip_changed and distance_km > self.MAX_DISTANCE_KM:
            is_suspicious = True
            flag_reason = f"IP and location changed significantly (IP: {initial_ip} → {ip_address}, Distance: {distance_km:.1f}km)"
            action = 'blocked'
        elif ip_changed:
            is_suspicious = True
            flag_reason = f"IP address changed during session (IP: {initial_ip} → {ip_address})"
            action = 'warning'
        elif distance_km > self.MAX_DISTANCE_KM:
            is_suspicious = True
            flag_reason = f"Location changed significantly during session (Distance: {distance_km:.1f}km)"
            action = 'warning'
        
        # Record current location
        location_record = UserLocation(
            customer_unique_id=customer_id,
            session_id=session_id,
            ip_address=ip_address,
            latitude=current_location['latitude'],
            longitude=current_location['longitude'],
            location_source=location_source,
            city=current_location['city'],
            country=current_location['country'],
            is_initial_login=False,
            is_flagged=is_suspicious,
            flag_reason=flag_reason
        )
        
        self.db.add(location_record)
        self.db.commit()
        
        if is_suspicious:
            print(f"🚨 [Location Service] SUSPICIOUS ACTIVITY DETECTED")
            print(f"   Reason: {flag_reason}")
        else:
            print(f"✅ [Location Service] Location verified successfully")
        
        return {
            'success': True,
            'is_suspicious': is_suspicious,
            'message': flag_reason or 'Location verified',
            'location': current_location,
            'distance_km': distance_km,
            'ip_changed': ip_changed,
            'action': action
        }
    
    def get_user_location_history(self, customer_id: uuid.UUID, limit: int = 10) -> List[Dict]:
        """Get user's recent location history."""
        locations = self.db.query(UserLocation).filter(
            UserLocation.customer_unique_id == customer_id
        ).order_by(UserLocation.created_at.desc()).limit(limit).all()
        
        return [
            {
                'session_id': loc.session_id,
                'ip_address': loc.ip_address,
                'latitude': loc.latitude,
                'longitude': loc.longitude,
                'city': loc.city,
                'country': loc.country,
                'source': loc.location_source,
                'is_flagged': loc.is_flagged,
                'flag_reason': loc.flag_reason,
                'created_at': loc.created_at.isoformat()
            }
            for loc in locations
        ]
    
    def cleanup_old_sessions(self, hours: int = 24):
        """Clean up location data older than specified hours."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        deleted_count = self.db.query(UserLocation).filter(
            UserLocation.created_at < cutoff_time
        ).delete()
        
        self.db.commit()
        print(f"🧹 [Location Service] Cleaned up {deleted_count} old location records")
        
        return deleted_count