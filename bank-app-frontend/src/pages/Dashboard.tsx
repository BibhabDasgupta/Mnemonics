import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CreditCard, TrendingUp, Send, Plus, Eye, LogOut, User } from 'lucide-react';
import bankLogo from '@/assets/bank-logo.png';
import { loadCustomerInfo } from '@/utils/deviceStateChecker';
import { useAppContext } from '@/context/AppContext';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
}

const Dashboard = () => {
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
    document.cookie = 'auth_token=; max-age=0; path=/; Secure; HttpOnly; SameSite=Strict';
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="bg-card shadow-card p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <img src={bankLogo} alt="GlowBank" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold text-foreground">GlowBank</h1>
              <p className="text-xs text-muted-foreground">Welcome back, {customerName || 'User'}!</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6 animate-fade-in">
        {/* Balance Card */}
        <Card className="p-6 bg-gradient-primary text-white shadow-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span className="text-sm opacity-90">{customerName || 'User'}</span>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
          <div>
            <p className="text-sm opacity-75 mb-1">Available Balance</p>
            <h2 className="text-3xl font-bold">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="flex items-center mt-4 space-x-4">
            <div className="text-xs">
              <p className="opacity-75">Account: ****4521</p>
            </div>
            <div className="text-xs">
              <p className="opacity-75">IFSC: GLOW0001234</p>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 hover:shadow-card transition-all cursor-pointer">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium">Transfer</span>
            </div>
          </Card>
          
          <Card className="p-4 hover:shadow-card transition-all cursor-pointer">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Plus className="w-6 h-6 text-accent" />
              </div>
              <span className="text-sm font-medium">Add Money</span>
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          
          <div className="space-y-3">
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${txn.type === 'credit' ? 'bg-accent/10' : 'bg-destructive/10'} rounded-full flex items-center justify-center`}>
                    {txn.type === 'credit' ? (
                      <TrendingUp className="w-5 h-5 text-accent" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${txn.type === 'credit' ? 'text-accent' : 'text-destructive'}`}>
                  {txn.type === 'credit' ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Services */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Banking Services</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: CreditCard, label: "Cards" },
              { icon: TrendingUp, label: "Investments" },
              { icon: Send, label: "Payments" },
            ].map((service, index) => (
              <div key={index} className="flex flex-col items-center space-y-2 cursor-pointer hover:bg-muted p-3 rounded-lg transition-colors">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <service.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-center">{service.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;