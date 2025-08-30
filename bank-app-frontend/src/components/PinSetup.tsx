// --- File: src/components/PinSetup.tsx ---
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  KeyRound
} from 'lucide-react';

interface PinSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isRequired?: boolean; // If true, user cannot close without setting PIN
}

export const PinSetup = ({ isOpen, onClose, onSuccess, isRequired = false }: PinSetupProps) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'setup' | 'confirm' | 'success'>('setup');

  const { toast } = useToast();

  const validatePin = (pinValue: string): string | null => {
    if (!pinValue) return 'PIN is required';
    if (pinValue.length < 4) return 'PIN must be at least 4 digits';
    if (pinValue.length > 6) return 'PIN cannot exceed 6 digits';
    if (!/^\d+$/.test(pinValue)) return 'PIN must contain only numbers';
    return null;
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setPin(numericValue);
    if (error) setError('');
  };

  const handleConfirmPinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setConfirmPin(numericValue);
    if (error) setError('');
  };

  const handleSetupPin = async () => {
    // Validate PIN
    const pinError = validatePin(pin);
    if (pinError) {
      setError(pinError);
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Call backend API to set PIN
      const response = await fetch('http://localhost:8000/api/v1/account/set-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          new_pin: pin
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to set PIN');
      }

      const result = await response.json();
      
      if (result.success) {
        setStep('success');
        toast({
          title: "PIN Set Successfully",
          description: "Your ATM PIN has been configured for enhanced transaction security.",
          variant: "default",
        });

        // Auto-close after success
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to set PIN');
      }

    } catch (err: any) {
      console.error('PIN setup error:', err);
      
      const errorMessage = err.message || "Failed to set PIN";
      setError(errorMessage);
      
      toast({
        title: "PIN Setup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isRequired && step !== 'success') {
      toast({
        title: "PIN Required",
        description: "Please set up your ATM PIN to continue using secure transactions.",
        variant: "destructive",
      });
      return;
    }

    // Reset form
    setPin('');
    setConfirmPin('');
    setError('');
    setStep('setup');
    setShowPin(false);
    setShowConfirmPin(false);
    onClose();
  };

  const getStepContent = () => {
    switch (step) {
      case 'setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Set Up ATM PIN</h2>
              <p className="text-gray-600">
                Create a secure 4-6 digit PIN for enhanced transaction verification
              </p>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Enhanced Security:</strong> Your PIN will be required along with biometric 
                authentication for high-risk transactions detected by our fraud prevention system.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pin">New ATM PIN</Label>
                <div className="relative">
                  <Input
                    id="new-pin"
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    placeholder="Enter 4-6 digits"
                    className="pr-10"
                    maxLength={6}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Use the same format as your physical ATM card PIN
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirm ATM PIN</Label>
                <div className="relative">
                  <Input
                    id="confirm-pin"
                    type={showConfirmPin ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => handleConfirmPinChange(e.target.value)}
                    placeholder="Re-enter PIN"
                    className="pr-10"
                    maxLength={6}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                  >
                    {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Confirm your PIN to ensure accuracy
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <h4 className="font-medium mb-2">PIN Requirements:</h4>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className={`w-3 h-3 ${pin.length >= 4 ? 'text-green-500' : 'text-gray-300'}`} />
                    <span>4-6 digits long</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className={`w-3 h-3 ${/^\d+$/.test(pin) && pin.length > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                    <span>Numbers only</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className={`w-3 h-3 ${pin === confirmPin && pin.length > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                    <span>Both PINs match</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2 text-green-800">PIN Setup Complete!</h2>
              <p className="text-gray-600">
                Your ATM PIN has been successfully configured for enhanced security.
              </p>
            </div>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your account now has enhanced fraud protection. High-risk transactions will require 
                both PIN and biometric verification.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={!isRequired ? handleClose : undefined}>
      <DialogContent className="sm:max-w-[500px]">{/* Note: Close button is controlled via onOpenChange prop */}
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-blue-600" />
            <span>ATM PIN Setup</span>
          </DialogTitle>
          <DialogDescription>
            {isRequired 
              ? "PIN setup is required for secure banking transactions."
              : "Set up an ATM PIN for enhanced transaction security."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {getStepContent()}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {step === 'setup' && (
            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading || isRequired}
                className="flex-1"
              >
                {isRequired ? 'PIN Required' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSetupPin}
                disabled={
                  isLoading || 
                  !pin || 
                  !confirmPin || 
                  pin !== confirmPin || 
                  pin.length < 4
                }
                className="flex-1"
              >
                {isLoading ? 'Setting up...' : 'Set PIN'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};