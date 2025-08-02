import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  CreditCard, 
  TrendingUp, 
  Send, 
  Plus, 
  Eye,
  LogOut,
  User
} from "lucide-react";
import bankLogo from "@/assets/bank-logo.png";

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="bg-card shadow-card p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <img src={bankLogo} alt="GlowBank" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold text-foreground">GlowBank</h1>
              <p className="text-xs text-muted-foreground">Welcome back!</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout}>
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
              <span className="text-sm opacity-90">John Doe</span>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
          <div>
            <p className="text-sm opacity-75 mb-1">Available Balance</p>
            <h2 className="text-3xl font-bold">₹1,24,856.50</h2>
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
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">Salary Credit</p>
                  <p className="text-xs text-muted-foreground">Today, 9:30 AM</p>
                </div>
              </div>
              <span className="text-sm font-medium text-accent">+₹45,000</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">ATM Withdrawal</p>
                  <p className="text-xs text-muted-foreground">Yesterday, 2:15 PM</p>
                </div>
              </div>
              <span className="text-sm font-medium text-destructive">-₹5,000</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">UPI Transfer</p>
                  <p className="text-xs text-muted-foreground">2 days ago, 6:45 PM</p>
                </div>
              </div>
              <span className="text-sm font-medium text-destructive">-₹1,250</span>
            </div>
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