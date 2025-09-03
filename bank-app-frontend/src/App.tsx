// --- File: src/App.tsx ---
import PWAInstallPrompt from './components/ui/PWAInstallPrompt';

// Then add <PWAInstallPrompt /> somewhere in your main App component JSX
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import ProtectedRoutes from "@/components/ProtectedRoutes";
import SplashScreenPage from "./pages/SplashScreenPage";
import LandingPage from "./pages/LandingPage";
import PhoneNumberPage from "./pages/PhoneNumberPage";
import RegistrationDetailsPage from "./pages/RegistrationDetailsPage";
import RestorationDetailsPage from "./pages/RestorationDetailsPage";
import FidoSeedKeyRegistrationPage from "./pages/FidoSeedKeyRegistrationPage";
import DeviceVerificationPage from "./pages/DeviceVerificationPage";
import DashboardPage from "./pages/DashboardPage";
import SignatureRegistrationPage from "./pages/SignatureRegistartionPage";
import FidoSeedKeyRestorationPage from "./pages/FidoSeedKeyRestorationPage";
import LoginPage from "./pages/LoginPage";
import RestorationPhonePage from "./pages/RestorationPhonePage";
import SignatureVerificationPage from "./pages/SignatureVerificationPage";
import RevokedPage from "./pages/RevokedPage";
import AlreadyRegisteredPage from "./pages/AlreadyRegsiteredPage";
import NotFound from "./pages/NotFound";
import SecurityVerificationPage from "./pages/SecurityVerificationPage";
import SecurityGuard from "@/components/SecurityGuard";
import { useEffect, useState, ReactNode } from "react";
import { initIndexedDB, loadCustomerInfo } from "@/utils/deviceStateChecker";
import { useAppContext } from "@/context/AppContext";
import { BehavioralAnalytics } from './providers/BehavioralAnalyticsProvider';

const queryClient = new QueryClient();

const RootRedirect = () => {
  const navigate = useNavigate();
  const { setCustomerId, setCustomerName } = useAppContext();
  const [showSplash, setShowSplash] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('RootRedirect: Component mounted at', new Date().toISOString());
    console.log('RootRedirect: Showing splash screen');
    const timer = setTimeout(async () => {
      console.log('RootRedirect: Starting IndexedDB check at', new Date().toISOString());
      try {
        console.log('RootRedirect: Initializing IndexedDB');
        await initIndexedDB();
        console.log('RootRedirect: Loading customer info');
        const customerInfo = await loadCustomerInfo();
        console.log('RootRedirect: Customer info:', customerInfo);
        if (customerInfo?.customerId && customerInfo?.name) {
          console.log('RootRedirect: Setting customerId and customerName in AppContext');
          setCustomerId(customerInfo.customerId);
          setCustomerName(customerInfo.name);
          console.log('RootRedirect: Navigating to /login');
          navigate("/login", { replace: true });
        } else {
          console.log('RootRedirect: No customer info found, navigating to /landing');
          navigate("/landing", { replace: true });
        }
      } catch (err) {
        console.error('RootRedirect: Error checking IndexedDB:', err);
        setError(`IndexedDB error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        navigate("/landing", { replace: true });
      } finally {
        console.log('RootRedirect: Hiding splash screen');
        setShowSplash(false);
      }
    }, 1500); // Show splash screen for 1.5 seconds

    return () => {
      console.log('RootRedirect: Cleaning up timer');
      clearTimeout(timer);
    };
  }, [navigate, setCustomerId, setCustomerName]);

  if (error) {
    console.error('RootRedirect: Rendering error:', error);
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Error: {error}
    </div>;
  }

  console.log('RootRedirect: Rendering splash screen:', showSplash);
  return showSplash ? <SplashScreenPage /> : null;
};

// Wrapper component to conditionally apply the right behavioral analytics provider
const BehavioralAnalyticsRouteWrapper = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  
  // Check if current route is a restoration route
  const isRestorationRoute = location.pathname.startsWith('/restoration/');
  const isRegistrationRoute = location.pathname.startsWith('/registration/');
  
  console.log(`[Analytics Route Wrapper] Current path: ${location.pathname}, Is restoration route: ${isRestorationRoute}, Is registration route: ${isRegistrationRoute}`);
  
  if (isRestorationRoute) {
    // Restoration routes: wrap with RestorationBehaviorProvider
    return (
      <BehavioralAnalytics.RestorationBehaviorProvider
        endpoint="http://localhost:3000/api/v1/analytics/behavior"
        intervalMs={30000}
        debug={false}
      >
        {children}
      </BehavioralAnalytics.RestorationBehaviorProvider>
    );
  } else if (isRegistrationRoute) {
    // Registration routes: no behavioral analytics wrapping
    return <>{children}</>;
  } else {
    // Everything else (/landing, /login, /security-verification, /dashboard, /revoked, /already-registered): wrap with regular Provider
    return (
      <BehavioralAnalytics.Provider
        endpoint="http://localhost:3000/api/v1/analytics/behavior"
        intervalMs={30000}
        debug={false}
      >
        {children}
      </BehavioralAnalytics.Provider>
    );
  }    
};

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BehavioralAnalyticsRouteWrapper>
            <SecurityGuard>
              <Routes>
                <Route element={<ProtectedRoutes />}>
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/registration/phone" element={<PhoneNumberPage title="Registration" isOTP={false} />} />
                  <Route path="/registration/otp" element={<PhoneNumberPage title="Registration - OTP Verification" isOTP={true} />} />
                  <Route path="/registration/details" element={<RegistrationDetailsPage />} />
                  <Route path="/registration/device-verification" element={<DeviceVerificationPage />} />
                  <Route path="/registration/fido-seedkey" element={<FidoSeedKeyRegistrationPage />} />
                  <Route path="/registration/signature" element={<SignatureRegistrationPage />} />
                  
                  {/* Restoration routes - these will be wrapped with RestorationBehaviorProvider */}
                  <Route path="/restoration/details" element={<RestorationDetailsPage />} />
                  <Route path="/restoration/phone" element={<RestorationPhonePage title="Account Restoration" />} />
                  <Route path="/restoration/fido-seedkey" element={<FidoSeedKeyRestorationPage />} />
                  <Route path="/restoration/signature" element={<SignatureVerificationPage />} />
                  
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/security-verification" element={<SecurityVerificationPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/revoked" element={<RevokedPage />} />
                  <Route path="/already-registered" element={<AlreadyRegisteredPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </SecurityGuard>
          </BehavioralAnalyticsRouteWrapper>
        </BrowserRouter>
      </TooltipProvider>
  </QueryClientProvider>
);

export default App;