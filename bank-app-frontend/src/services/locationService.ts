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
  
  // ✅ Reverse geocoding function for GPS coordinates
  static async reverseGeocode(latitude: number, longitude: number): Promise<{city: string, country: string} | null> {
    try {
      // Using a free reverse geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      console.log('🌍 [LocationService] Reverse geocoding result:', data);
      
      return {
        city: data.city || data.locality || data.principalSubdivision || 'Unknown City',
        country: data.countryName || 'Unknown Country'
      };
      
    } catch (error) {
      console.error('🌍 [LocationService] Reverse geocoding error:', error);
      
      // Fallback: Try with another service
      try {
        const fallbackResponse = await fetch(
          `https://geocode.xyz/${latitude},${longitude}?json=1`
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          return {
            city: fallbackData.city || 'Unknown City',
            country: fallbackData.country || 'Unknown Country'
          };
        }
      } catch (fallbackError) {
        console.error('🌍 [LocationService] Fallback geocoding also failed:', fallbackError);
      }
      
      return null;
    }
  }

  // ✅ FIX: Make getCurrentLocation async
  static async getCurrentLocation(): Promise<LocationData | null> {
    if (!navigator.geolocation) {
      console.log('🌍 [LocationService] Geolocation not supported');
      return null;
    }
    
    return new Promise(async (resolve) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      };
      
      navigator.geolocation.getCurrentPosition(
        async (position) => { // ✅ FIX: Make success callback async
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          
          this.lastKnownLocation = location;
          console.log('🌍 [LocationService] GPS location obtained:', location);
          
          // ✅ FIX: Now properly await the reverse geocoding
          try {
            console.log('🌍 [LocationService] Starting reverse geocoding...');
            const geocodedLocation = await this.reverseGeocode(location.latitude, location.longitude);
            if (geocodedLocation) {
              console.log('🌍 [LocationService] Location resolved to:', geocodedLocation);
              // Store the geocoded info with the location
              (location as any).city = geocodedLocation.city;
              (location as any).country = geocodedLocation.country;
            } else {
              console.log('🌍 [LocationService] Reverse geocoding returned null');
              (location as any).city = 'GPS Location';
              (location as any).country = 'GPS Location';
            }
          } catch (error) {
            console.error('🌍 [LocationService] Error during reverse geocoding:', error);
            // Fallback values if geocoding fails
            (location as any).city = 'GPS Location';
            (location as any).country = 'GPS Location';
          }

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
  
  // ✅ UPDATE: Enhanced location tracking with geocoding
  static startLocationTracking(): void {
    if (!navigator.geolocation || this.watchId !== null) {
      return;
    }
    
    const options = {
      enableHighAccuracy: false, // Less battery intensive for continuous tracking
      timeout: 15000,
      maximumAge: 6000000 // 10 minutes
    };
    
    this.watchId = navigator.geolocation.watchPosition(
      async (position) => { // ✅ FIX: Make callback async for geocoding
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        
        // ✅ ADD: Reverse geocode for continuous tracking too
        try {
          const geocodedLocation = await this.reverseGeocode(location.latitude, location.longitude);
          if (geocodedLocation) {
            (location as any).city = geocodedLocation.city;
            (location as any).country = geocodedLocation.country;
            console.log('🌍 [LocationService] Tracking location updated:', `${geocodedLocation.city}, ${geocodedLocation.country}`);
          }
        } catch (error) {
          console.error('🌍 [LocationService] Tracking geocoding error:', error);
        }
        
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