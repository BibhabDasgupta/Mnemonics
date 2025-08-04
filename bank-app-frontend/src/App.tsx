import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/appContext";
import ProtectedRoutes from "@/components/ProtectedRoutes";
import SplashScreenPage from "./pages/SplashScreenPage";
import LandingPage from "./pages/LandingPage";
import PhoneNumberPage from "./pages/PhoneNumberPage";
import RegistrationDetailsPage from "./pages/RegistrationDetailsPage";
import RestorationDetailsPage from "./pages/RestorationDetailsPage";
import FidoSeedKeyRegistrationPage from "./pages/FidoSeedKeyRegistrationPage";
import DeviceVerificationPage from "./pages/DeviceVerificationPage";
import DashboardPage from "./pages/Dashboard";
import SignatureRegistrationPage from "./pages/SignatureRegistartionPage";
import LoginPage from "./pages/LoginPAge";
import RevokedPage from "./pages/RevokedPage";
import AlreadyRegisteredPage from "./pages/AlreadyRegsiteredPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<SplashScreenPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/registration/phone" element={<PhoneNumberPage title="Registration" isOTP={false} />} />
            <Route path="/registration/otp" element={<PhoneNumberPage title="Registration - OTP Verification" isOTP={true} />} />
            <Route path="/registration/details" element={<RegistrationDetailsPage />} />
            <Route path="/registration/device-verification" element={<DeviceVerificationPage />} />
            <Route path="/registration/fido-seedkey" element={<FidoSeedKeyRegistrationPage />} />
            <Route path="/registration/signature" element={<SignatureRegistrationPage />} />
            <Route path="/restoration/phone" element={<PhoneNumberPage title="Account Restoration" isOTP={false} />} />
            <Route path="/restoration/details" element={<RestorationDetailsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/revoked" element={<RevokedPage />} />
            <Route path="/already-registered" element={<AlreadyRegisteredPage />} />
            <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;