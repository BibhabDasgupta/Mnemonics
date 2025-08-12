// --- File: src/services/locationService.ts ---
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface LocationValidationResult {
  success: boolean;
  is_suspicious: boolean;
  message: string;
  location?: any;
  distance_km?: number;
  ip_changed?: boolean;
  action?: string;
}

export class LocationService {
  private static readonly API_BASE = 'http://localhost:8000/api/v1';
  private static lastKnownLocation: LocationData | null = null;
  private static watchId: number | null = null;
  
  static async getCurrentLocation(): Promise<LocationData | null> {
    if (!navigator.geolocation) {
      console.log('🌍 [LocationService] Geolocation not supported');
      return null;
    }
    
    return new Promise((resolve) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          
          this.lastKnownLocation = location;
          console.log('🌍 [LocationService] GPS location obtained:', location);
          resolve(location);
        },
        (error) => {
          console.log('🌍 [LocationService] GPS error:', error.message);
          resolve(null);
        },
        options
      );
    });
  }
  
  static async requestLocationPermission(): Promise<boolean> {
    if (!navigator.geolocation) {
      return false;
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      
      if (permission.state === 'granted') {
        console.log('🌍 [LocationService] Location permission already granted');
        return true;
      } else if (permission.state === 'prompt') {
        console.log('🌍 [LocationService] Requesting location permission');
        // Try to get location (will prompt user)
        const location = await this.getCurrentLocation();
        return location !== null;
      } else {
        console.log('🌍 [LocationService] Location permission denied');
        return false;
      }
    } catch (error) {
      console.log('🌍 [LocationService] Permission check failed:', error);
      return false;
    }
  }
  
  static startLocationTracking(): void {
    if (!navigator.geolocation || this.watchId !== null) {
      return;
    }
    
    const options = {
      enableHighAccuracy: false, // Less battery intensive for continuous tracking
      timeout: 15000,
      maximumAge: 600000 // 10 minutes
    };
    
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        
        this.lastKnownLocation = location;
        console.log('🌍 [LocationService] Location updated:', location);
      },
      (error) => {
        console.log('🌍 [LocationService] Location tracking error:', error.message);
      },
      options
    );
    
    console.log('🌍 [LocationService] Started continuous location tracking');
  }
  
  static stopLocationTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('🌍 [LocationService] Stopped location tracking');
    }
  }
  
  static getLastKnownLocation(): LocationData | null {
    return this.lastKnownLocation;
  }
  
  static async validateLocation(
    customerId: string,
    sessionId: string
  ): Promise<LocationValidationResult> {
    const location = this.getLastKnownLocation();
    
    const payload = {
      customer_unique_id: customerId,
      session_id: sessionId,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null
    };
    
    try {
      const response = await fetch(`${this.API_BASE}/location/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Location validation failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('🌍 [LocationService] Validation result:', result);
      
      return result;
    } catch (error) {
      console.error('🌍 [LocationService] Validation error:', error);
      return {
        success: false,
        is_suspicious: false,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  static async getLocationHistory(customerId: string, limit: number = 10) {
    try {
      const response = await fetch(`${this.API_BASE}/location/history/${customerId}?limit=${limit}`);
      return await response.json();
    } catch (error) {
      console.error('🌍 [LocationService] History error:', error);
      return null;
    }
  }
}
