import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import Dashboard from '@/components/Dashboard';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { customerName } = useAppContext();
  const [balance, setBalance] = useState(124856.50);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', description: 'Salary Credit', amount: 45000, type: 'credit', date: 'Today, 9:30 AM' },
    { id: '2', description: 'ATM Withdrawal', amount: -5000, type: 'debit', date: 'Yesterday, 2:15 PM' },
    { id: '3', description: 'UPI Transfer', amount: -1250, type: 'debit', date: '2 days ago, 6:45 PM' },
  ]);

  useEffect(() => {
    const checkToken = () => {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];

      if (!token) {
        navigate('/login', { replace: true });
      }
    };

    checkToken();
    window.addEventListener('popstate', (event) => {
      event.preventDefault();
      navigate('/dashboard', { replace: true });
    });

    return () => {
      window.removeEventListener('popstate', () => {});
    };
  }, [navigate]);

  const handleLogout = () => {
    document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
    navigate('/login', { replace: true });
  };

  return (
    <Dashboard
      customerName={customerName}
      balance={balance}
      transactions={transactions}
      onLogout={handleLogout}
    />
  );
};

export default DashboardPage;