// --- File: src/pages/LoginPage.tsx ---
import { useNavigate } from "react-router-dom";
import FidoLogin from "@/components/FidoLogin";
import { useEffect, useState } from "react";
import { loadCustomerInfo } from "@/utils/deviceStateChecker";
import { useAppContext } from "@/context/AppContext";
import { useLocationContext } from "@/context/LocationContext"; // ✅ ADD
import { AuthService } from '@/services/authService';

const LoginPage = () => {
  const navigate = useNavigate();
  const { setCustomerId, setCustomerName } = useAppContext();
  
  // Location context for storing login location
  const { userFriendlyLocation, hasLocationPermission, requestPermission } = useLocationContext();
  
  const [customerName, setLocalCustomerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('LoginPage: Component mounted at', new Date().toISOString());
    const fetchCustomerInfo = async () => {
      setIsLoading(true);
      try {
        console.log('LoginPage: Loading customer info from IndexedDB');
        const customerInfo = await loadCustomerInfo();
        console.log('LoginPage: Customer info:', customerInfo);
        if (customerInfo && customerInfo.customerId && customerInfo.name) {
          setCustomerId(customerInfo.customerId);
          setCustomerName(customerInfo.name);
          setLocalCustomerName(customerInfo.name);
        } else {
          console.log('LoginPage: No customer info found, redirecting to /landing');
          navigate("/landing", { replace: true });
        }
      } catch (err) {
        console.error('LoginPage: Error loading customer info:', err);
        setError(`Failed to load customer info: ${err instanceof Error ? err.message : 'Unknown error'}`);
        navigate("/landing", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerInfo();
  }, [navigate, setCustomerId, setCustomerName]);

  // Initialize location tracking on login page
  useEffect(() => {
    const initializeLocationForLogin = async () => {
      if (!hasLocationPermission) {
        console.log('🌍 [LoginPage] Requesting location permission for login tracking');
        try {
          await requestPermission();
        } catch (error) {
          console.log('🌍 [LoginPage] Location permission not granted, proceeding without GPS');
        }
      }
    };

    if (!isLoading) {
      initializeLocationForLogin();
    }
  }, [isLoading, hasLocationPermission, requestPermission]);

  // Enhanced success handler with AuthService integration
  const handleLoginSuccess = async (responseData?: any) => {
  console.log('🔐 [LoginPage] Login successful, storing login data');
  
  try {
    // ✅ FIX: Store better login data
    const loginData = {
      customer_id: responseData?.customer_unique_id || 'unknown',
      last_login: new Date().toISOString(),
      login_location: userFriendlyLocation !== 'Location unavailable' ? userFriendlyLocation : 'Location not available',
      device_info: `${navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                     navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                     navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'} on ${navigator.platform}`
    };
    
    console.log('🔐 [LoginPage] Storing enhanced login data:', loginData);
    AuthService.storeLoginData(loginData);
    
  } catch (error) {
    console.error('🔐 [LoginPage] Error storing login data:', error);
  }
  
  navigate("/dashboard", { replace: true });
};

  // Enhanced logout handler (for future use)
  const handleLogout = () => {
    console.log('🔐 [LoginPage] Logging out, clearing stored data');
    
    try {
      // Clear login data
      AuthService.clearLoginData();
      
      // Clear auth cookie
      document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
      
      console.log('🔐 [LoginPage] Logout data cleared successfully');
    } catch (error) {
      console.error('🔐 [LoginPage] Error during logout cleanup:', error);
    }
    
    navigate('/login', { replace: true });
  };

  // Enhanced proceed handler
  const handleProceed = () => {
    console.log('🔐 [LoginPage] Manual proceed triggered');
    handleLoginSuccess();
  };

  if (error) {
    console.error('LoginPage: Rendering error:', error);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Error: {error}
      </div>
    );
  }

  if (isLoading) {
    console.log('LoginPage: Rendering loading state');
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#f0f0f0',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>Loading...</div>
        {/* Show location loading status */}
        <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
        {hasLocationPermission ? (
          userFriendlyLocation.includes('unavailable') ? 
          '📍 Resolving location...' : 
          `📍 ${userFriendlyLocation}`
        ) : (
          '📍 Preparing location services...'
        )}
      </div>
      </div>
    );
  }

  console.log('LoginPage: Rendering FidoLogin with customerName:', customerName);
  console.log('🌍 [LoginPage] Current location for login:', userFriendlyLocation);
  
  return (
    <div>
      {/* Optional location status indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 1000
        }}>
          🌍 {userFriendlyLocation}
        </div>
      )}
      
      <FidoLogin 
        onSuccess={handleLoginSuccess} 
        customerName={customerName}
      />
    </div>
  );
};

export default LoginPage;