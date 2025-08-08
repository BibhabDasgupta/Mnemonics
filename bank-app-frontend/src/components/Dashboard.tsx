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
  LayoutGrid, // New icon for a better visual cue in the header
  Menu // Icon for mobile menu toggle (future-proofing)
} from "lucide-react";
import bankLogo from "@/assets/bank-logo.png";

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  return (
      <div className="min-h-screen bg-gradient-surface">
        {/* --- Header --- */}
        {/* The header now has responsive padding and its content spans a wider area on larger screens. */}
        <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-card">
          <div className="flex items-center justify-between max-w-7xl mx-auto p-4">
            <div className="flex items-center space-x-3">
              <img src={bankLogo} alt="GlowBank" className="w-9 h-9" />
              <div>
                <h1 className="text-lg font-bold text-foreground">GlowBank</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Welcome back, John!</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="hidden lg:inline-flex">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
              {/* A menu button for smaller screens, can be wired up for a mobile navigation drawer. */}
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* --- Main Content Area --- */}
        {/* This is the core of the responsive enhancement.
          - On mobile (default), it's a single column (`space-y-6`).
          - On large screens (`lg:`), it becomes a two-column grid.
          - The right column (sidebar) contains the balance and quick actions.
          - The left column (main content) contains transactions and services.
      */}
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in">

            {/* -- Right Column (Sidebar on Desktop) -- */}
            {/* This column is ordered first in the code to appear on top on mobile screens. */}
            <div className="lg:col-span-1 space-y-6">
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
                  <h2 className="text-3xl font-bold tracking-tight">₹1,24,856.50</h2>
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

              {/* Quick Actions */}
              {/* Grid columns adjust for medium screens for better spacing. */}
              <Card className="p-4">
                <h3 className="text-md font-semibold mb-4 px-2">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  <div className="flex flex-col items-center space-y-2 p-3 hover:bg-muted rounded-lg transition-all cursor-pointer">
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

            {/* -- Left Column (Main Content on Desktop) -- */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Transactions */}
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Transactions</h3>
                  <Button variant="ghost" size="sm">View All</Button>
                </div>

                <div className="space-y-3">
                  {/* Transaction Item 1 */}
                  <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Salary Credit</p>
                        <p className="text-xs text-muted-foreground">Today, 9:30 AM</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-accent">+₹45,000.00</span>
                  </div>

                  {/* Transaction Item 2 */}
                  <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">ATM Withdrawal</p>
                        <p className="text-xs text-muted-foreground">Yesterday, 2:15 PM</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-destructive">-₹5,000.00</span>
                  </div>

                  {/* Transaction Item 3 */}
                  <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Send className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">UPI to Blinkit</p>
                        <p className="text-xs text-muted-foreground">2 days ago, 6:45 PM</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-destructive">-₹1,250.50</span>
                  </div>
                </div>
              </Card>

              {/* Banking Services */}
              {/* The grid now supports more items and wraps gracefully. */}
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