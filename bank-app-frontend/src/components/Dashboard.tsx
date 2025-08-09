// --- File: src/components/Dashboard.tsx ---

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CreditCard,
  TrendingUp,
  Send,
  Plus,
  Eye,
  LogOut,
  User,
  LayoutGrid,
  Menu
} from "lucide-react";
import bankLogo from "@/assets/bank-logo.png";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
}

interface DashboardProps {
  onLogout: () => void;
  onInitiateTransaction: () => void;
  customerName: string | null;
  balance: number;
  transactions: Transaction[];
}

const Dashboard = ({ onLogout, onInitiateTransaction, customerName, balance, transactions }: DashboardProps) => {
  return (
      <div className="min-h-screen bg-gradient-surface">
        <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-card">
          <div className="flex items-center justify-between max-w-7xl mx-auto p-4">
            <div className="flex items-center space-x-3">
              <img src={bankLogo} alt="GlowBank" className="w-9 h-9" />
              <div>
                <h1 className="text-lg font-bold text-foreground">GlowBank</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Welcome back, {customerName || 'User'}!</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="hidden lg:inline-flex">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in">

            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 bg-gradient-primary text-white shadow-glow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span className="text-sm opacity-90">{customerName || 'John Doe'}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <p className="text-sm opacity-75 mb-1">Available Balance</p>
                  <h2 className="text-3xl font-bold tracking-tight">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(balance)}
                  </h2>
                </div>
                <div className="flex items-center mt-4 space-x-4">
                  <div className="text-xs">
                    <p className="opacity-75">Account: **** 4521</p>
                  </div>
                  <div className="text-xs">
                    <p className="opacity-75">IFSC: GLOW0001234</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-md font-semibold mb-4 px-2">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  <div onClick={onInitiateTransaction} className="flex flex-col items-center space-y-2 p-3 hover:bg-muted rounded-lg transition-all cursor-pointer">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Send className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Transfer</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2 p-3 hover:bg-muted rounded-lg transition-all cursor-pointer">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-accent" />
                    </div>
                    <span className="text-sm font-medium">Add Money</span>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Transactions</h3>
                  <Button variant="ghost" size="sm">View All</Button>
                </div>
                <div className="space-y-3">
                  {transactions.length > 0 ? (
                      transactions.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  tx.type === 'credit' ? 'bg-accent/10' : 'bg-destructive/10'
                              }`}>
                                {tx.type === 'credit' ? (
                                    <TrendingUp className="w-5 h-5 text-accent" />
                                ) : (
                                    <CreditCard className="w-5 h-5 text-destructive" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleString()}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-medium ${
                                tx.type === 'credit' ? 'text-accent' : 'text-destructive'
                            }`}>
                            {tx.type === 'credit' ? '+' : ''}
                              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(tx.amount)}
                        </span>
                          </div>
                      ))
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
                  )}
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">Banking Services</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: CreditCard, label: "My Cards" },
                    { icon: TrendingUp, label: "Investments" },
                    { icon: Send, label: "Bill Payments" },
                    { icon: Plus, label: "Apply Loan" },
                  ].map((service) => (
                      <div key={service.label} className="flex flex-col items-center space-y-2 cursor-pointer hover:bg-muted p-3 rounded-lg transition-colors">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <service.icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-center">{service.label}</span>
                      </div>
                  ))}
                </div>
              </Card>
            </div>

          </div>
        </main>
      </div>
  );
};

export default Dashboard;