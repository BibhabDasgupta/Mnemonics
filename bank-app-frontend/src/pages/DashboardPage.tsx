// --- File: src/pages/DashboardPage.tsx ---
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useLocationContext } from '@/context/LocationContext';
import Dashboard from '@/components/Dashboard';
import { TransactionModal } from '@/components/TransactionModal';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { customerId, customerName } = useAppContext();
  const { requestPermission, startTracking, hasLocationPermission } = useLocationContext();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccountData = useCallback(async () => {
    if (!customerId) return;

    const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/accounts/${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch account data.");

      const data = await response.json();
      if (data.length > 0) {
        setBalance(data[0].balance);
        setTransactions(data[0].transactions);
      }
    } catch (error) {
      console.error("Error fetching account data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, navigate]);

  // Initialize location tracking on dashboard load
  useEffect(() => {
    const initializeLocationTracking = async () => {
      if (!hasLocationPermission) {
        console.log('🌍 [Dashboard] Requesting location permission for security');
        const granted = await requestPermission();
        if (granted) {
          console.log('🌍 [Dashboard] Starting location tracking');
          startTracking();
        } else {
          console.log('🌍 [Dashboard] Location permission denied - continuing without GPS');
        }
      } else {
        console.log('🌍 [Dashboard] Location permission already granted, starting tracking');
        startTracking();
      }
    };

    const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
    if (!token) {
      navigate('/login', { replace: true });
    } else {
      fetchAccountData();
      initializeLocationTracking();
    }
  }, [navigate, fetchAccountData, hasLocationPermission, requestPermission, startTracking]);

  const handleLogout = () => {
    document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
    navigate('/login', { replace: true });
  };

  const handleTransactionSuccess = (newBalance: number) => {
    setBalance(newBalance);
    fetchAccountData();
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;
  }

  return (
      <>
        <Dashboard
            customerName={customerName}
            balance={balance}
            transactions={transactions}
            onLogout={handleLogout}
            onInitiateTransaction={() => setIsTransactionModalOpen(true)}
        />
        <TransactionModal
            isOpen={isTransactionModalOpen}
            onClose={() => setIsTransactionModalOpen(false)}
            onTransactionSuccess={handleTransactionSuccess}
        />
      </>
  );
};

export default DashboardPage;