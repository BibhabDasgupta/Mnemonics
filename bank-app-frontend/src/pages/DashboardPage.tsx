import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useLocationContext } from '@/context/LocationContext';
import Dashboard from '@/components/Dashboard';
import { TransactionModal } from '@/components/TransactionModal';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  account_number: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  terminal_id: string;
}

interface Account {
  account_number: string;
  account_type: string;
  balance: number;
  customer_id: string;
  transactions: Transaction[];
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { customerName, customerId, selectedAccount, setSelectedAccount } = useAppContext();
  const { requestPermission, startTracking, hasLocationPermission } = useLocationContext();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchAccountData = useCallback(async () => {
    if (!customerId || !selectedAccount) {
      console.log('No customerId or selectedAccount available');
      setIsLoading(false);
      return;
    }

    const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
    if (!token) {
      console.log('No auth token found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    console.log('Fetching account data for account:', selectedAccount.account_number);
    setIsLoading(true);
    
    try {
      const response = await fetch(`http://localhost:8000/api/v1/account/${selectedAccount.account_number}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch account data.");
      }

      const data = await response.json();
      console.log('Account data received:', data);
      setSelectedAccount(data);
    } catch (error) {
      console.error("Error fetching account data:", error);
      toast.error('Failed to load account data', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [customerId, selectedAccount, setSelectedAccount, navigate]);

  const initializeLocationTracking = useCallback(async () => {
    console.log('Initializing location tracking...');
    
    if (!hasLocationPermission) {
      const granted = await requestPermission();
      if (granted) {
        startTracking();
      }
    } else {
      startTracking();
    }
  }, [hasLocationPermission, requestPermission, startTracking]);

  // Main initialization effect
  useEffect(() => {
    console.log('Dashboard useEffect triggered', { customerId, hasInitialized });
    
    if (!customerId) {
      console.log('Waiting for customerId...');
      return;
    }

    if (hasInitialized) {
      console.log('Already initialized, skipping...');
      return;
    }

    const initialize = async () => {
      console.log('Starting dashboard initialization...');
      
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      // Fetch account data first
      await fetchAccountData();
      
      // Initialize location tracking (only once per session)
      await initializeLocationTracking();
      
      setHasInitialized(true);
      console.log('Dashboard initialization complete');
    };

    initialize();
  }, [customerId, hasInitialized, navigate, fetchAccountData, initializeLocationTracking]);

  // Reset initialization when customerId changes (user switches accounts)
  useEffect(() => {
    setHasInitialized(false);
  }, [customerId]);

  
   const handleLogout = useCallback(async () => {
    try {
      // Call logout endpoint to decrease logged in devices count
      if (customerId) {
        console.log('Calling logout API for customer:', customerId);
        const response = await fetch('http://localhost:8000/api/v1/logout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_id: customerId
          })
        });

        // Don't block logout if API call fails
        if (response.ok) {
          const result = await response.json();
          console.log('Logout API response:', result);
          toast.success('Logged out successfully');
        } else {
          console.warn('Logout API call failed, but proceeding with logout');
          toast.warning('Logout completed (with minor issues)');
        }
      }
    } catch (error) {
      // Don't block logout if API call fails
      console.warn('Logout API call error, but proceeding with logout:', error);
      toast.warning('Logout completed (with minor issues)');
    } finally {
      // Always proceed with local logout regardless of API call result
      document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
      setHasInitialized(false);
      console.log('Local logout completed, navigating to login page');
      navigate('/login', { replace: true });
    }
  }, [navigate, customerId]);


  // If we don't have basic requirements, show loading
  if (!customerId || !selectedAccount || isLoading || !hasInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <span className="text-lg text-gray-700">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  console.log('Rendering dashboard with:', {
    customerName,
    balance: selectedAccount.balance,
    transactionsCount: selectedAccount.transactions.length,
    accountNumber: selectedAccount.account_number,
  });

  return (
    <div className="min-h-screen bg-white">
      <Dashboard
        customerName={customerName}
        balance={selectedAccount.balance}
        transactions={selectedAccount.transactions}
        onLogout={handleLogout}
        onInitiateTransaction={() => setIsTransactionModalOpen(true)}
      />
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
      />
    </div>
  );
};

export default DashboardPage;