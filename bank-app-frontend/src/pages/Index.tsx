import { useState, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import LandingPage from "@/components/LandingPage";
import PhoneNumberStep from "@/components/PhoneNumberStep";
import RegistrationDetails from "@/components/RegistrationDetails";
import RestorationDetails from "@/components/RestorationDetails";
import DeviceVerification from "@/components/DeviceVerification";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

type AppState =
  | 'splash'
  | 'landing'
  | 'registration-phone'
  | 'registration-otp'
  | 'registration-details'
  | 'restoration-phone'
  | 'restoration-details'
  | 'login'
  | 'dashboard'
  | 'revoked'
  | 'already-registered'
  | 'device-verification';

const Index = () => {
  const [currentState, setCurrentState] = useState<AppState>('splash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log("Current app state:", {
      state: currentState,
      phone: phoneNumber,
      customerId: customerId,
      error: error
    });
  }, [currentState, phoneNumber, customerId, error]);

  const handleSplashComplete = () => {
    setCurrentState('landing');
  };

  const handleNavigation = (page: 'registration' | 'login' | 'restoration') => {
    if (page === 'registration') {
      setCurrentState('registration-phone');
    } else if (page === 'login') {
      setCurrentState('login');
    } else if (page === 'restoration') {
      setCurrentState('restoration-phone');
    }
    setError('');
  };

  const handlePhoneSubmit = (phone: string, status?: string, customerId?: string) => {
    setPhoneNumber(phone);
    setCustomerId(customerId);
    
    if (currentState === 'registration-phone') {
      if (status === 'revoked') {
        setCurrentState('revoked');
      } else if (status === 'registered' || status === 'preregistered') {
        setCurrentState('already-registered');
      } else {
        // TEMPORARY: Skip OTP step and go directly to registration-details (registration-otp SKIPPED)
        setCurrentState('registration-details');
      }
    } else if (currentState === 'restoration-phone') {
      if (status === 'revoked') {
        setCurrentState('revoked');
      } else if (status === 'new') {
        setCurrentState('landing');
        setError('Phone number not registered. Please register first.');
      } else {
        setCurrentState('restoration-details');
      }
    }
    setError('');
  };

  const handleOTPSubmit = (phone: string, status: string, customerId?: string) => {
    console.log("OTP Submit Triggered", { status });
    
    setPhoneNumber(phone);
    if (customerId) setCustomerId(customerId);
    setError('');

    setCurrentState(prev => {
      console.log("Current state before update:", prev);
      
      if (status === 'revoked') return 'revoked';
      if (status === 'registered' || status === 'preregistered') return 'already-registered';
      if (status === 'verified') {
        console.log("Transitioning to registration-details");
        return 'registration-details';
      }
      
      console.error("Unexpected status:", status);
      return prev;
    });
  };

  const handleRegistrationComplete = () => {
    setCurrentState('device-verification');
    setError('');
  };

  const handleRestorationComplete = () => {
    setCurrentState('login');
    setError('');
  };

   const handleDeviceVerificationComplete = () => {
    setCurrentState('login');
    setError('');
  };

  const handleLoginComplete = () => {
    setCurrentState('dashboard');
    setError('');
  };

  const handleLogout = () => {
    setCurrentState('login');
    setPhoneNumber('');
    setCustomerId(undefined);
    setError('');
  };

  const handleBack = () => {
    if (currentState === 'registration-phone' || currentState === 'restoration-phone' || currentState === 'login' || currentState === 'revoked' || currentState === 'already-registered') {
      setCurrentState('landing');
    } else if (currentState === 'registration-otp') {
      setCurrentState('registration-phone');
    } else if (currentState === 'registration-details') {
      setCurrentState('registration-otp');
    } else if (currentState === 'restoration-details') {
      setCurrentState('restoration-phone');
    }
    setError('');
  };

  switch (currentState) {
    case 'splash':
      return <SplashScreen onComplete={handleSplashComplete} />;
    
    case 'landing':
      return <LandingPage onNavigation={handleNavigation} />;
    
    case 'registration-phone':
      return (
        <PhoneNumberStep
          title="Registration"
          onBack={handleBack}
          onProceed={handlePhoneSubmit}
          error={error}
          setError={setError}
          isOTP={false}
        />
      );
    
    case 'registration-otp':
      return (
        <PhoneNumberStep
          title="Registration - OTP Verification"
          onBack={handleBack}
          onProceed={handleOTPSubmit}
          phoneNumber={phoneNumber}
          error={error}
          setError={setError}
          isOTP={true}
        />
      );
    
    case 'registration-details':
      return (
        <RegistrationDetails
          onBack={handleBack}
          onProceed={handleRegistrationComplete}
          phoneNumber={phoneNumber}
          customerId={customerId}
        />
      );

    case 'device-verification':
      return (
        <DeviceVerification
          onBack={handleBack}
          onProceed={handleDeviceVerificationComplete}
          phoneNumber={phoneNumber}
          customerId={customerId}
        />
      );
    
    case 'restoration-phone':
      return (
        <PhoneNumberStep
          title="Account Restoration"
          onBack={handleBack}
          onProceed={handlePhoneSubmit}
          error={error}
          setError={setError}
          isOTP={false}
        />
      );
    
    case 'restoration-details':
      return (
        <RestorationDetails
          onBack={handleBack}
          onProceed={handleRestorationComplete}
          customerId={customerId}
        />
      );
    
    case 'login':
      return (
        <Login
          onBack={handleBack}
          onProceed={handleLoginComplete}
        />
      );
    
    case 'dashboard':
      return <Dashboard onLogout={handleLogout} />;
    
    case 'revoked':
      return (
        <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">
                Access Revoked
              </h1>
            </div>
            <p className="text-muted-foreground mb-6">
              App access is revoked. Please visit a branch for re-registration.
            </p>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleBack}
            >
              Back to Landing
            </Button>
          </Card>
        </div>
      );
    
    case 'already-registered':
      return (
        <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">
                Already Registered
              </h1>
            </div>
            <p className="text-muted-foreground mb-6">
              Phone number already registered. Restore it to continue.
            </p>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={() => setCurrentState('restoration-phone')}
            >
              Proceed to Restoration
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="w-full mt-4"
              onClick={handleBack}
            >
              Back to Landing
            </Button>
          </Card>
        </div>
      );
    
    default:
      return <SplashScreen onComplete={handleSplashComplete} />;
  }
};

export default Index;