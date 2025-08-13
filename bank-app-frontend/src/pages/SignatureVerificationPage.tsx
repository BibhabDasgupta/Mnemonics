// --- File: src/pages/SignatureVerificationPage.tsx ---
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SignatureVerification from '@/components/SignatureVerification';
import { useAppContext } from '@/context/AppContext';
import { useLocationContext } from '@/context/LocationContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Wifi,
  Lock
} from 'lucide-react';

const SignatureVerificationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError } = useAppContext();
  
  // Enhanced location context integration
  const { 
    hasLocationPermission, 
    isTracking, 
    lastValidation,
    requestPermission,
    startTracking,
    validateCurrentLocation
  } = useLocationContext();

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationValidationComplete, setLocationValidationComplete] = useState(false);

  // Check location on page load
  useEffect(() => {
    const initializeLocationSecurity = async () => {
      if (!hasLocationPermission) {
        setShowLocationPrompt(true);
      } else {
        // Validate current location for security
        if (customerId) {
          const validation = await validateCurrentLocation();
          setLocationValidationComplete(true);
          
          if (validation?.is_suspicious && validation?.action === 'blocked') {
            setError('Suspicious location activity detected. Please verify your identity from a trusted location.');
          }
        }
      }
    };

    initializeLocationSecurity();
  }, [hasLocationPermission, customerId, validateCurrentLocation, setError]);

  const handleLocationPermissionRequest = async () => {
    const granted = await requestPermission();
    if (granted) {
      startTracking();
      setShowLocationPrompt(false);
      
      // Validate location after permission granted
      if (customerId) {
        const validation = await validateCurrentLocation();
        setLocationValidationComplete(true);
        
        if (validation?.is_suspicious && validation?.action === 'blocked') {
          setError('Suspicious location activity detected. Please verify your identity from a trusted location.');
        }
      }
    }
  };

  const handleProceed = () => {
    setError('');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Security Header */}
        <div className="max-w-2xl mx-auto mb-6">
          <Card className="p-4 bg-white/80 backdrop-blur-sm border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-sm font-semibold text-blue-900">Security Verification</h2>
                  <p className="text-xs text-blue-700">Enhanced protection active</p>
                </div>
              </div>
              
              {/* Security Status Indicators */}
              <div className="flex items-center space-x-2">
                {/* Encryption Status */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1">
                      <Wifi className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-medium text-green-700 hidden sm:inline">Encrypted</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>End-to-end encrypted connection</p>
                  </TooltipContent>
                </Tooltip>

                {/* Location Status */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1">
                      <MapPin className={`w-3 h-3 ${hasLocationPermission ? 'text-green-500' : 'text-yellow-500'}`} />
                      <span className={`text-xs font-medium ${hasLocationPermission ? 'text-green-700' : 'text-yellow-700'} hidden sm:inline`}>
                        {hasLocationPermission ? 'Location' : 'No GPS'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{hasLocationPermission ? 'GPS location tracking active' : 'GPS permission required for enhanced security'}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Security Lock */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="w-3 h-3 text-green-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Signature verification with location validation</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        </div>

        {/* Location Permission Prompt */}
        {showLocationPrompt && (
          <div className="max-w-2xl mx-auto mb-6">
            <Alert className="border-amber-200 bg-amber-50">
              <MapPin className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Enhanced Security Available</strong>
                    <p className="text-sm mt-1">Enable location tracking for additional account protection during verification.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={handleLocationPermissionRequest}
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    Enable
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Location Security Alerts */}
        {lastValidation && lastValidation.is_suspicious && (
          <div className="max-w-2xl mx-auto mb-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Location Security Alert</strong>
                <p className="text-sm mt-1">{lastValidation.message}</p>
                {lastValidation.distance_km && (
                  <p className="text-xs mt-1">Distance from usual location: {lastValidation.distance_km.toFixed(1)}km</p>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Location Validation Success */}
        {locationValidationComplete && lastValidation && !lastValidation.is_suspicious && (
          <div className="max-w-2xl mx-auto mb-6">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Location Verified</strong>
                <p className="text-sm mt-1">
                  Your location has been validated. 
                  {lastValidation.location?.city && ` Detected location: ${lastValidation.location.city}`}
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Security Status Summary */}
        {hasLocationPermission && isTracking && (
          <div className="max-w-2xl mx-auto mb-6">
            <Card className="p-3 bg-green-50 border-green-200">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">
                  Multi-factor security active: Signature + Location + Device verification
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Location Security Details Card */}
        {lastValidation && (
          <div className="max-w-2xl mx-auto mb-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-purple-600" />
                Location Security Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Location Source:</span>
                  <Badge variant="outline">
                    {lastValidation.location?.source?.toUpperCase() || 'Unknown'}
                  </Badge>
                </div>
                
                {lastValidation.distance_km !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Location Change:</span>
                    <span className="font-medium">
                      {lastValidation.distance_km.toFixed(1)} km
                    </span>
                  </div>
                )}
                
                {lastValidation.ip_changed !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">IP Address:</span>
                    <Badge variant={lastValidation.ip_changed ? "destructive" : "secondary"}>
                      {lastValidation.ip_changed ? "Changed" : "Stable"}
                    </Badge>
                  </div>
                )}
                
                {lastValidation.location && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>City: {lastValidation.location.city || 'Unknown'}</div>
                      <div>Country: {lastValidation.location.country || 'Unknown'}</div>
                      {lastValidation.location.latitude && lastValidation.location.longitude && (
                        <div>
                          Coordinates: {lastValidation.location.latitude.toFixed(4)}, {lastValidation.location.longitude.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Main Signature Verification Component */}
        <SignatureVerification
          onProceed={handleProceed}
          phoneNumber={phoneNumber}
          customerId={customerId}
        />

        {/* Additional Security Information */}
        <div className="max-w-2xl mx-auto mt-6">
          <Card className="p-4 bg-gray-50 border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Security Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="flex items-center space-x-2">
                <Lock className="w-3 h-3 text-blue-500" />
                <span>Signature verification</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className={`w-3 h-3 ${hasLocationPermission ? 'text-green-500' : 'text-gray-400'}`} />
                <span>Location validation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wifi className="w-3 h-3 text-purple-500" />
                <span>Encrypted connection</span>
              </div>
            </div>
            
            {lastValidation && lastValidation.location && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  <p>Current session location: {lastValidation.location.city || 'Unknown'}, {lastValidation.location.country || 'Unknown'}</p>
                  <p>Source: {lastValidation.location.source?.toUpperCase() || 'Unknown'}</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignatureVerificationPage;