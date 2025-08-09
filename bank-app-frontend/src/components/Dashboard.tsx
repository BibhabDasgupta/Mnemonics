// --- File: src/components/Dashboard.tsx ---

import { useEffect, useMemo, useRef, useState } from "react";
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
  Menu,
} from "lucide-react";
import bankLogo from "@/assets/bank-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
}

interface DashboardProps {
  onLogout: () => void;
  onInitiateTransaction: () => void;
  customerName: string | null;
  balance: number;
  transactions: Transaction[];
}

const PAGE_SIZE_DEFAULT = 3;
const MODAL_BATCH_SIZE = 20;

const Dashboard = ({
  onLogout,
  onInitiateTransaction,
  customerName,
  balance,
  transactions,
}: DashboardProps) => {
  // Pagination state for Recent Transactions card
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = PAGE_SIZE_DEFAULT;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((transactions?.length || 0) / pageSize)),
    [transactions, pageSize]
  );

  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (transactions || []).slice(start, start + pageSize);
  }, [transactions, currentPage, pageSize]);

  // View All modal state with infinite scroll
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MODAL_BATCH_SIZE);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + MODAL_BATCH_SIZE, transactions.length));
        }
      },
      { root: null, rootMargin: "0px", threshold: 1.0 }
    );

    if (endRef.current) observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [open, transactions.length]);

  useEffect(() => {
    if (open) {
      setVisibleCount(Math.min(MODAL_BATCH_SIZE, transactions.length));
    }
  }, [open, transactions.length]);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto p-4">
          <div className="flex items-center space-x-3">
            <img src={bankLogo} alt="GlowBank" className="w-9 h-9" />
            <div>
              <h1 className="text-lg font-bold text-foreground">GlowBank</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Welcome back, {customerName || "User"}!
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex">
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout">
              <LogOut className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 bg-gradient-primary text-white shadow-glow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span className="text-sm opacity-90">{customerName || "John Doe"}</span>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" aria-label="Toggle balance visibility">
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Available Balance</p>
                <h2 className="text-3xl font-bold tracking-tight">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(balance)}
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
                <div
                  onClick={onInitiateTransaction}
                  className="flex flex-col items-center space-y-2 p-3 hover:bg-muted rounded-lg transition-all cursor-pointer"
                >
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

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Transactions with pagination */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  View All
                </Button>
              </div>

              <div className="space-y-3">
                {paginatedTx.length > 0 ? (
                  paginatedTx.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
                )}
              </div>

              {/* Pagination controls */}
              {transactions.length > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Services */}
            <Card className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Banking Services</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: CreditCard, label: "My Cards" },
                  { icon: TrendingUp, label: "Investments" },
                  { icon: Send, label: "Bill Payments" },
                  { icon: Plus, label: "Apply Loan" },
                ].map((service) => (
                  <div
                    key={service.label}
                    className="flex flex-col items-center space-y-2 cursor-pointer hover:bg-muted p-3 rounded-lg transition-colors"
                  >
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

      {/* View All Modal with infinite scroll */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>All Transactions</DialogTitle>
            <DialogDescription>Scroll to load more</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
            {(transactions || []).slice(0, visibleCount).map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
            {/* Sentinel for infinite loading */}
            {visibleCount < transactions.length && (
              <div ref={endRef} className="py-4 text-center text-xs text-muted-foreground">
                Loading more…
              </div>
            )}
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
      <div className="flex items-center space-x-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            tx.type === "credit" ? "bg-accent/10" : "bg-destructive/10"
          }`}
        >
          {tx.type === "credit" ? (
            <TrendingUp className="w-5 h-5 text-accent" />
          ) : (
            <CreditCard className="w-5 h-5 text-destructive" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{tx.description}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(tx.date).toLocaleString()}
          </p>
        </div>
      </div>
      <span
        className={`text-sm font-medium ${
          tx.type === "credit" ? "text-accent" : "text-destructive"
        }`}
      >
        {tx.type === "credit" ? "+" : ""}
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
          tx.amount
        )}
      </span>
    </div>
  );
}

export default Dashboard;