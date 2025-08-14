// --- File: src/components/Dashboard.tsx ---

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Shield,
  Clock,
  MapPin,
  Smartphone,
  Wifi,
  Lock,
  Activity,
  CheckCircle,
} from "lucide-react";
import bankLogo from "@/assets/bank-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSecurityContext } from "@/context/SecurityContext";
import { useLocationContext } from "@/context/LocationContext";
import { AuthService } from "@/services/authService";

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
  // Existing state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = PAGE_SIZE_DEFAULT;
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MODAL_BATCH_SIZE);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Security context and new security state
  const { isSecurityBlocked } = useSecurityContext();
  
  // Location context integration
  const { 
    hasLocationPermission, 
    isTracking, 
    lastValidation,
    userFriendlyLocation,
    requestPermission,
    startTracking 
  } = useLocationContext();

  // ✅ FIX: Better OS detection
  const getOS = () => {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    
    // More specific detection
    if (ua.includes("Win")) return "Windows";
    if (ua.includes("Mac") || platform.includes("Mac")) return "macOS";
    if (ua.includes("Linux") && !ua.includes("Android")) return "Linux";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (ua.includes("CrOS")) return "Chrome OS";
    
    return platform || "Unknown";
  };

  // ✅ FIX: Better browser detection
  const getBrowser = () => {
    const ua = navigator.userAgent;
    
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
    if (ua.includes("Opera/") || ua.includes("OPR/")) return "Opera";
    
    return "Unknown";
  };

  // ✅ UPDATE: Enhanced device info state
  const [lastLoginTime, setLastLoginTime] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState({
    browser: getBrowser(),
    os: getOS(),
    location: 'Loading...'
  });

  // ✅ UPDATE: Enhanced data loading effect
  useEffect(() => {
    const loadUserData = async () => {
      console.log('🔧 [Dashboard] Loading user data...');
      console.log('🌍 [Dashboard] Current userFriendlyLocation:', userFriendlyLocation);
      
      // Load last login time with better fallback
      let loginTime = AuthService.getLastLoginTime();
      if (!loginTime) {
        // Check if we have a stored session start
        const sessionStart = AuthService.getCurrentSessionStart();
        if (!sessionStart) {
          // Create a session start time and store it
          const now = new Date().toISOString();
          AuthService.storeLoginData({
            customer_id: 'current_user',
            last_login: now,
            login_location: userFriendlyLocation,
            device_info: `${getBrowser()} on ${getOS()}`
          });
          loginTime = now;
        } else {
          loginTime = sessionStart;
        }
      }
      setLastLoginTime(loginTime);

      // ✅ UPDATE: Better device info with real data
      const updatedDeviceInfo = {
        browser: getBrowser(),
        os: getOS(),
        location: userFriendlyLocation !== 'Location unavailable' ? userFriendlyLocation : 'Loading...'
      };
      
      console.log('🔧 [Dashboard] Updated device info:', updatedDeviceInfo);
      setDeviceInfo(updatedDeviceInfo);
    };

    loadUserData();
  }, [userFriendlyLocation]); // Re-run when location changes

  const [securityStatus] = useState({
    behavioralMonitoring: true,
    deviceTrusted: true,
    mlProtection: true,
    encryptionActive: true,
  });
  const [balanceVisible, setBalanceVisible] = useState(true);

  // Existing pagination logic
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((transactions?.length || 0) / pageSize)),
    [transactions, pageSize]
  );

  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (transactions || []).slice(start, start + pageSize);
  }, [transactions, currentPage, pageSize]);

  // Existing useEffects
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

  // ✅ UPDATE: Enhanced login time formatting
  const formatLastLogin = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;
    
    // For older dates, show actual date
    return date.toLocaleDateString('en-IN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto p-4">
          <div className="flex items-center space-x-3">
            <img src={bankLogo} alt="GlowBank" className="w-9 h-9" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Bank</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Welcome back, {customerName || "User"}!
              </p>
            </div>
          </div>
          
          {/* Enhanced Header with Security Status */}
          <div className="flex items-center space-x-2">
            {/* Security Status Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-50 border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Shield className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700 hidden sm:inline">Secure</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">Security Status: Active</p>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>Behavioral monitoring active</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>ML fraud protection enabled</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>End-to-end encryption</span>
                    </div>
                    {/* Location security status in header tooltip */}
                    <div className="flex items-center space-x-1">
                      <CheckCircle className={`w-3 h-3 ${hasLocationPermission ? 'text-green-500' : 'text-yellow-500'}`} />
                      <span>{hasLocationPermission ? 'Location tracking active' : 'Location permission pending'}</span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

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
            {/* Enhanced Balance Card with Security */}
            <Card className="p-6 bg-gradient-primary text-white shadow-glow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span className="text-sm opacity-90">{customerName || "John Doe"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Security indicator in balance card */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-1">
                        <Lock className="w-3 h-3 opacity-75" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Account secured with behavioral biometrics</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/20" 
                    aria-label="Toggle balance visibility"
                    onClick={() => setBalanceVisible(!balanceVisible)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm opacity-75 mb-1">Available Balance</p>
                <h2 className="text-3xl font-bold tracking-tight">
                  {balanceVisible 
                    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(balance)
                    : "₹ ****.**"
                  }
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

            {/* Quick Actions */}
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

            {/* ✅ UPDATE: Enhanced Security Information Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold">Security Info</h3>
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              
              <div className="space-y-3 text-xs">
                {/* ✅ FIX: Last Login with better display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Last login</span>
                  </div>
                  <span className="font-medium" title={lastLoginTime ? new Date(lastLoginTime).toLocaleString() : 'Unknown'}>
                    {formatLastLogin(lastLoginTime)}
                  </span>
                </div>

                {/* ✅ FIX: Device Info with browser only */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Device</span>
                  </div>
                  <span className="font-medium" title={`${deviceInfo.browser} on ${deviceInfo.os}`}>
                    {deviceInfo.browser}
                  </span>
                </div>

                {/* ✅ FIX: OS Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">OS</span>
                  </div>
                  <span className="font-medium">
                    {deviceInfo.os}
                  </span>
                </div>

                {/* ✅ FIX: Real Location Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Location</span>
                  </div>
                  <span className="font-medium" title={`Source: ${lastValidation?.location?.source || 'GPS'}`}>
                    {userFriendlyLocation !== 'Location unavailable' && 
                     userFriendlyLocation !== 'GPS Location, GPS Location' ? 
                     userFriendlyLocation : 
                     'Resolving...'}
                  </span>
                </div>

                {/* Enhanced Security Features Status Grid */}
                <div className="pt-2 border-t border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-blue-500" />
                          <span className="text-blue-700 font-medium">Behavioral</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Behavioral biometrics active</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1">
                          <Shield className="w-3 h-3 text-green-500" />
                          <span className="text-green-700 font-medium">ML Guard</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>AI fraud detection enabled</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1">
                          <Wifi className="w-3 h-3 text-purple-500" />
                          <span className="text-purple-700 font-medium">Encrypted</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>End-to-end encrypted connection</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Location status in security grid */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1">
                          <MapPin className={`w-3 h-3 ${hasLocationPermission ? 'text-green-500' : 'text-yellow-500'}`} />
                          <span className={`font-medium ${hasLocationPermission ? 'text-green-700' : 'text-yellow-700'}`}>
                            {hasLocationPermission ? 'Location' : 'No GPS'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{hasLocationPermission ? 'GPS location tracking active' : 'GPS permission required'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Location permission request UI */}
                {!hasLocationPermission && (
                  <div className="pt-2 border-t border-border">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs"
                      onClick={async () => {
                        console.log('🌍 [Dashboard] Requesting location permission');
                        const granted = await requestPermission();
                        if (granted) {
                          console.log('🌍 [Dashboard] Permission granted, starting tracking');
                          startTracking();
                        } else {
                          console.log('🌍 [Dashboard] Permission denied');
                        }
                      }}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Enable Location Security
                    </Button>
                  </div>
                )}

                {/* Location validation status alerts */}
                {lastValidation && lastValidation.is_suspicious && (
                  <div className="pt-2 border-t border-red-200">
                    <Badge variant="destructive" className="w-full justify-center text-xs animate-pulse">
                      Location Alert: {lastValidation.message}
                    </Badge>
                  </div>
                )}

                {/* Location tracking status indicator */}
                {hasLocationPermission && isTracking && (
                  <div className="pt-2 border-t border-green-200">
                    <div className="flex items-center justify-center space-x-1 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium">Location monitoring active</span>
                    </div>
                  </div>
                )}

                {/* Security Alert if blocked */}
                {isSecurityBlocked && (
                  <div className="pt-2 border-t border-red-200">
                    <Badge variant="destructive" className="w-full justify-center animate-pulse">
                      Security Alert Active
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right column - Enhanced with security notices */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location-based security notice */}
            {lastValidation && lastValidation.distance_km > 10 && !lastValidation.is_suspicious && (
              <Card className="p-4 bg-amber-50 border-amber-200">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">
                      Location change detected
                    </p>
                    <p className="text-xs text-amber-700">
                      We noticed you're {lastValidation.distance_km.toFixed(1)}km from your usual location. Your account remains secure.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Security Notice Banner (only show occasionally) */}
            {Math.random() > 0.7 && ( // Show 30% of the time
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Your account is protected by advanced behavioral biometrics
                    </p>
                    <p className="text-xs text-blue-700">
                      We continuously monitor your typing and mouse patterns for enhanced security
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-100">
                    Learn More
                  </Button>
                </div>
              </Card>
            )}

            {/* Recent Transactions with enhanced security info */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold">Recent Transactions</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="w-3 h-3 text-green-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>All transactions are monitored by AI fraud detection</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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

      {/* Existing modal */}
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

// Enhanced Transaction Row with security indicator
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
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">{tx.description}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <CheckCircle className="w-3 h-3 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Transaction verified by AI fraud detection</p>
              </TooltipContent>
            </Tooltip>
          </div>
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