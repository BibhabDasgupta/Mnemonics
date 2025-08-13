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
  
  // Generate session ID (in real app, this would come from auth system)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const requestPermission = async (): Promise<boolean> => {
    console.log('🌍 [LocationContext] Requesting location permission');
    const hasPermission = await LocationService.requestLocationPermission();
    setHasLocationPermission(hasPermission);
    
    if (hasPermission) {
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
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
  
  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (navigator.geolocation) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          setHasLocationPermission(permission.state === 'granted');
          
          if (permission.state === 'granted') {
            const location = await LocationService.getCurrentLocation();
            setCurrentLocation(location);
          }
        } catch (error) {
          console.log('🌍 [LocationContext] Permission check failed:', error);
        }
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