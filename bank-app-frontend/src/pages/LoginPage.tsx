import { useNavigate } from "react-router-dom";
import FidoLogin from "@/components/FidoLogin";
import { useEffect, useState } from "react";
import { loadCustomerInfo } from "@/utils/deviceStateChecker";
import { useAppContext } from "@/context/AppContext";
import { useLocationContext } from "@/context/LocationContext";
import { AuthService } from "@/services/authService";

interface Account {
  account_number: string;
  account_type: string;
  balance: number;
  customer_id: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  account_number: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  terminal_id: string;
}

const LoginPage = () => {
  const navigate = useNavigate();
  const { setCustomerId, setCustomerName, setSelectedAccount } = useAppContext();
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

  useEffect(() => {
    const initializeLocationForLogin = async () => {
      if (!hasLocationPermission) {
        console.log('LoginPage: Requesting location permission for login tracking');
        try {
          await requestPermission();
        } catch (error) {
          console.log('LoginPage: Location permission not granted, proceeding without GPS');
        }
      }
    };

    if (!isLoading) {
      initializeLocationForLogin();
    }
  }, [isLoading, hasLocationPermission, requestPermission]);

  const handleLoginSuccess = async (selectedAccount?: Account) => {
    console.log('LoginPage: Login successful, processing account selection');
    try {
      const customerInfo = await loadCustomerInfo();
      const loginData = {
        customer_id: customerInfo?.customerId || 'unknown',
        last_login: new Date().toISOString(),
        login_location: userFriendlyLocation !== 'Location unavailable' ? userFriendlyLocation : 'Location not available',
        device_info: `${navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                      navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                      navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'} on ${navigator.platform}`,
        selected_account: selectedAccount || null,
      };
      console.log('LoginPage: Storing enhanced login data:', loginData);
      AuthService.storeLoginData(loginData);
      
      if (selectedAccount) {
        console.log('LoginPage: Setting selected account in AppContext:', {
          accountNumber: selectedAccount.account_number,
          balance: selectedAccount.balance,
          transactionCount: selectedAccount.transactions?.length || 0
        });
        setSelectedAccount(selectedAccount);
        
        // Navigate to dashboard immediately after account selection
        navigate("/dashboard", { replace: true });
      } else {
        // This shouldn't happen with the new flow, but keeping as fallback
        console.warn('LoginPage: No account selected, this should not happen');
        setError('No account was selected during login');
      }
    } catch (error) {
      console.error('LoginPage: Error processing login success:', error);
      setError(`Failed to process login: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Still navigate to dashboard even if there's an error storing login data
      if (selectedAccount) {
        setSelectedAccount(selectedAccount);
        navigate("/dashboard", { replace: true });
      }
    }
  };

  const handleLogout = () => {
    console.log('LoginPage: Logging out, clearing stored data');
    try {
      AuthService.clearLoginData();
      document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
      setSelectedAccount(null);
      console.log('LoginPage: Logout data cleared successfully');
    } catch (error) {
      console.error('LoginPage: Error during logout cleanup:', error);
      setError(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    navigate('/login', { replace: true });
  };

  if (error) {
    console.error('LoginPage: Rendering error:', error);
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fee',
        padding: '20px'
      }}>
        <div style={{ 
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Error</h2>
          <p style={{ color: '#374151', marginBottom: '16px' }}>{error}</p>
          <button 
            onClick={() => window.location.href = '/landing'} 
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Return to Landing
          </button>
        </div>
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
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div>Loading customer information...</div>
        <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
          {hasLocationPermission ? (
            userFriendlyLocation.includes('unavailable') ? 
            'Resolving location...' : 
            `Location: ${userFriendlyLocation}`
          ) : (
            'Preparing location services...'
          )}
        </div>
      </div>
    );
  }

  console.log('LoginPage: Rendering FidoLogin with customerName:', customerName);
  console.log('LoginPage: Current location for login:', userFriendlyLocation);
  
  return (
    <div>
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