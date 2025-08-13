// --- File: src/context/LocationContext.tsx ---
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LocationService } from '@/services/locationService';
import { useAppContext } from './AppContext';
import { useSecurityContext } from './SecurityContext';

interface LocationContextType {
  hasLocationPermission: boolean;
  currentLocation: any;
  isTracking: boolean;
  lastValidation: any;
  userFriendlyLocation: string;
  requestPermission: () => Promise<boolean>;
  startTracking: () => void;
  stopTracking: () => void;
  validateCurrentLocation: () => Promise<any>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { customerId } = useAppContext();
  const { setSecurityAlert } = useSecurityContext();
  
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastValidation, setLastValidation] = useState(null);
  const [userFriendlyLocation, setUserFriendlyLocation] = useState('Location unavailable');
  
  // Generate session ID (in real app, this would come from auth system)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // ✅ UPDATE: Enhanced function to handle GPS locations
  const updateUserFriendlyLocation = (validation: any, gpsLocation: any = null) => {
  console.log('🌍 [LocationContext] Updating friendly location:', { validation, gpsLocation, currentLocation });
  
  // Priority 1: Use GPS location if available with city/country
  if (gpsLocation && (gpsLocation.city || gpsLocation.country)) {
    const city = gpsLocation.city || 'Unknown City';
    const country = gpsLocation.country || 'Unknown Country';
    const newLocation = `${city}, ${country}`;
    console.log('🌍 [LocationContext] Using GPS location:', newLocation);
    setUserFriendlyLocation(newLocation);
    return;
  }
  
  // Priority 2: Use current location if it has geocoded data
  if (currentLocation && ((currentLocation as any).city || (currentLocation as any).country)) {
    const city = (currentLocation as any).city || 'Unknown City';
    const country = (currentLocation as any).country || 'Unknown Country';
    const newLocation = `${city}, ${country}`;
    console.log('🌍 [LocationContext] Using current location:', newLocation);
    setUserFriendlyLocation(newLocation);
    return;
  }
  
  // Priority 3: Use validation location data
  if (validation?.location) {
    const { city, country, source } = validation.location;
    if (city && country) {
      const newLocation = `${city}, ${country}`;
      console.log('🌍 [LocationContext] Using validation location:', newLocation);
      setUserFriendlyLocation(newLocation);
      return;
    } else if (city) {
      console.log('🌍 [LocationContext] Using city only:', city);
      setUserFriendlyLocation(city);
      return;
    } else if (country) {
      console.log('🌍 [LocationContext] Using country only:', country);
      setUserFriendlyLocation(country);
      return;
    }
  }
  
  // Priority 4: Try to get fresh GPS location
  if (hasLocationPermission) {
    console.log('🌍 [LocationContext] Getting fresh GPS location');
    LocationService.getCurrentLocation().then((freshLocation) => {
      if (freshLocation && ((freshLocation as any).city || (freshLocation as any).country)) {
        const city = (freshLocation as any).city || 'Unknown City';
        const country = (freshLocation as any).country || 'Unknown Country';
        const newLocation = `${city}, ${country}`;
        console.log('🌍 [LocationContext] Fresh GPS location:', newLocation);
        setUserFriendlyLocation(newLocation);
        setCurrentLocation(freshLocation); // Update current location
      } else {
        console.log('🌍 [LocationContext] Fresh GPS location has no geocoding, resolving...');
        setUserFriendlyLocation('Resolving location...');
      }
    }).catch((error) => {
      console.error('🌍 [LocationContext] Error getting fresh GPS location:', error);
      setUserFriendlyLocation('Location unavailable');
    });
  } else {
    console.log('🌍 [LocationContext] No location permission, using fallback');
    setUserFriendlyLocation('GPS permission required');
  }
};

  const requestPermission = async (): Promise<boolean> => {
    console.log('🌍 [LocationContext] Requesting location permission');
    const hasPermission = await LocationService.requestLocationPermission();
    setHasLocationPermission(hasPermission);
    
    if (hasPermission) {
      console.log('🌍 [LocationContext] Permission granted, getting location');
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
      
      // ✅ UPDATE: Pass GPS location to update function
      updateUserFriendlyLocation(null, location);
    } else {
      console.log('🌍 [LocationContext] Permission denied');
      setUserFriendlyLocation('GPS permission denied');
    }
    
    return hasPermission;
  };
  
  const startTracking = () => {
    if (hasLocationPermission) {
      LocationService.startLocationTracking();
      setIsTracking(true);
      console.log('🌍 [LocationContext] Started location tracking');
    }
  };
  
  const stopTracking = () => {
    LocationService.stopLocationTracking();
    setIsTracking(false);
    console.log('🌍 [LocationContext] Stopped location tracking');
  };
  
  const validateCurrentLocation = async () => {
    if (!customerId) {
      console.log('🌍 [LocationContext] No customer ID for validation');
      return null;
    }
    
    console.log('🌍 [LocationContext] Validating current location');
    const result = await LocationService.validateLocation(customerId, sessionId);
    setLastValidation(result);
    
    // ✅ UPDATE: Update location with validation result
    updateUserFriendlyLocation(result);
    
    // Handle suspicious location activity
    if (result.is_suspicious && result.action === 'blocked') {
      console.log('🚨 [LocationContext] Suspicious location activity detected');
      
      // Create location-based security alert
      const alert = {
        id: `location_alert_${Date.now()}`,
        timestamp: new Date().toISOString(),
        riskLevel: 'HIGH' as const,
        confidence: 95,
        anomalyType: 'Location/IP Change Detected',
        recommendations: [
          'Unusual location or IP address change detected',
          'Potential session hijacking or unauthorized access',
          'Account access temporarily restricted',
          'Please re-authenticate to confirm your identity',
          'Contact support if you are traveling or using a new network'
        ],
        blocked: true
      };
      
      setSecurityAlert(alert);
      sessionStorage.setItem('security_alert', JSON.stringify(alert));
    }
    
    return result;
  };
  
  // Auto-validate location periodically for active sessions
  useEffect(() => {
    if (hasLocationPermission && customerId && isTracking) {
      // Validate immediately
      validateCurrentLocation();
      
      // Then validate every 5 minutes
      const interval = setInterval(validateCurrentLocation, 5 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [hasLocationPermission, customerId, isTracking]);
  
  // ✅ ADD: Check permission and get location on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (navigator.geolocation) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          const hasPermission = permission.state === 'granted';
          setHasLocationPermission(hasPermission);
          
          if (hasPermission) {
            console.log('🌍 [LocationContext] Permission already granted, getting location');
            const location = await LocationService.getCurrentLocation();
            setCurrentLocation(location);
            updateUserFriendlyLocation(null, location);
          } else {
            console.log('🌍 [LocationContext] Permission not granted');
            setUserFriendlyLocation('GPS permission required');
          }
        } catch (error) {
          console.log('🌍 [LocationContext] Permission check failed:', error);
          setUserFriendlyLocation('Location unavailable');
        }
      } else {
        console.log('🌍 [LocationContext] Geolocation not supported');
        setUserFriendlyLocation('Geolocation not supported');
      }
    };
    
    checkPermission();
  }, []);
  
  return (
    <LocationContext.Provider value={{
      hasLocationPermission,
      currentLocation,
      isTracking,
      lastValidation,
      userFriendlyLocation,
      requestPermission,
      startTracking,
      stopTracking,
      validateCurrentLocation
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};