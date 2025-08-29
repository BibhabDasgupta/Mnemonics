// --- File: src/components/TransactionRetry.tsx ---
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { TransactionService, TransactionData } from '@/services/transactionService';
import { useSecurityContext } from '@/context/SecurityContext';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  CreditCard, 
  Fingerprint, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  User, 
  Lock,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

interface TransactionRetryProps {
  transactionData: TransactionData;
  onSuccess: () => void;
  onCancel: () => void;
}

type AuthStep = 'pin_entry' | 'pin_verifying' | 'pin_verified' | 'fido_authenticating' | 'transaction_processing' | 'completed' | 'failed';

export const TransactionRetry = ({ transactionData, onSuccess, onCancel }: TransactionRetryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStep, setAuthStep] = useState<AuthStep>('pin_entry');
  
  // PIN-related state
  const [pinValue, setPinValue] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { clearAlert, currentAlert } = useSecurityContext();
  const navigate = useNavigate();

  const handlePinVerification = async () => {
    if (!pinValue || pinValue.length < 4) {
      setError('Please enter a valid 4-6 digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');
    setAuthStep('pin_verifying');

    try {
      console.log('PIN verification started');
      
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const response = await fetch('http://localhost:8000/api/v1/transactions/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          atm_pin: pinValue,
          original_fraud_alert_id: currentAlert?.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'PIN verification failed');
      }

      const result = await response.json();

      if (result.verified) {
        console.log('PIN verification successful');
        setAuthStep('pin_verified');
        setAttemptsRemaining(null);
        
        toast({
          title: "PIN Verified",
          description: "ATM PIN verified successfully. Please complete biometric authentication.",
          variant: "default",
        });

        // Auto-proceed to FIDO2 after short delay
        setTimeout(() => {
          handleFIDO2Authentication();
        }, 1500);

      } else {
        console.warn('PIN verification failed:', result.message);
        setAuthStep('pin_entry');
        setError(result.message);
        setAttemptsRemaining(result.attempts_remaining);
        setPinAttempts(prev => prev + 1);

        // Handle lockout
        if (result.locked_until) {
          toast({
            title: "PIN Locked",
            description: `Too many incorrect attempts. PIN locked until ${new Date(result.locked_until).toLocaleString()}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Incorrect PIN",
            description: result.message,
            variant: "destructive",
          });
        }
      }

    } catch (err: any) {
      console.error('PIN verification error:', err);
      setAuthStep('pin_entry');
      
      const errorMessage = err.message || "PIN verification failed";
      setError(errorMessage);
      
      toast({
        title: "PIN Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFIDO2Authentication = async () => {
    setAuthStep('fido_authenticating');
    setError('');

    try {
      console.log('Starting FIDO2 authentication after PIN verification');
      
      toast({
        title: "Biometric Authentication Required",
        description: "Please authenticate using your fingerprint, face, or Windows Hello.",
        variant: "default",
      });

      const originalAlertId = currentAlert?.id;

      console.log('Enhanced authentication details:', {
        amount: transactionData.amount,
        recipient: transactionData.recipient_account_number,
        originalAlertId: originalAlertId || 'N/A',
        pinVerified: true
      });

      setAuthStep('transaction_processing');

      // Execute transaction with PIN verification flag
      const enhancedTransactionData = {
        ...transactionData,
        is_reauth_transaction: true,
        pin_verified: true, // Mark that PIN was verified
        original_fraud_alert_id: originalAlertId
      };

      const result = await TransactionService.executeWithFIDO2Auth(enhancedTransactionData, originalAlertId);

      console.log('Enhanced authentication result:', {
        status: result.status,
        blocked: result.blocked || false,
        fraudDetectionBypassed: result.fraud_detection_bypassed || false,
        isReauth: result.is_reauth_transaction || false,
        pinVerified: result.pin_verified || false,
        authMethod: result.auth_method || 'unknown'
      });

      // Check for successful transaction
      if (result.status === "Transaction successful") {
        setAuthStep('completed');
        
        let successMessage = `Your transaction has been completed successfully!`;
        if (result.fraud_detection_bypassed) {
          successMessage += ` (Fraud detection bypassed after PIN + biometric authentication)`;
        }
        if (result.auth_method === 'pin_and_fido') {
          successMessage += ` Authentication: PIN + Biometric`;
        }
        successMessage += ` New balance: ₹${result.new_balance.toLocaleString()}`;
        
        toast({
          title: "Transaction Successful!",
          description: successMessage,
          variant: "default",
        });

        console.log('Enhanced authentication transaction completed:', {
          newBalance: result.new_balance,
          fraudBypassed: result.fraud_detection_bypassed,
          authMethod: result.auth_method,
          pinVerified: result.pin_verified,
          securityNotice: result.security_notice
        });

        // Show success state briefly, then redirect
        setTimeout(() => {
          clearAlert();
          navigate('/dashboard');
          onSuccess();
        }, 2000);
        
      } else if (result.fraud_prediction && result.blocked) {
        setAuthStep('failed');
        console.error('Transaction still blocked despite PIN + FIDO2 authentication:', result);
        
        toast({
          title: "Unusual Security Issue",
          description: "Despite successful PIN and biometric authentication, this transaction requires additional review. Please contact support.",
          variant: "destructive",
        });
        setError("Transaction requires additional security review despite successful PIN and biometric authentication.");
        
      } else {
        throw new Error(result.message || result.detail || 'Transaction failed unexpectedly');
      }

    } catch (err: any) {
      console.error('Enhanced authentication failed:', err);
      setAuthStep('failed');
      
      const errorMessage = err.message || "Enhanced authentication failed";
      setError(errorMessage);
      
      // Handle specific error cases
      if (errorMessage.includes("cancelled")) {
        toast({
          title: "Authentication Cancelled",
          description: "Biometric authentication was cancelled. You can retry when ready.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("not available")) {
        toast({
          title: "Biometric Authentication Unavailable",
          description: "Biometric authentication is not available on this device. Please contact support.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("Session expired")) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. You will be redirected to login.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          clearAlert();
          document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        toast({
          title: "Enhanced Authentication Failed",
          description: errorMessage.length > 100 ? "An error occurred during enhanced authentication. Please try again." : errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      if (authStep !== 'completed') {
        setIsLoading(false);
      }
    }
  };

  const resetAuthentication = () => {
    setAuthStep('pin_entry');
    setPinValue('');
    setError('');
    setIsLoading(false);
  };

  const getStepDisplay = () => {
    switch (authStep) {
      case 'pin_entry':
        return {
          icon: <KeyRound className="w-8 h-8 text-blue-500 mx-auto mb-2" />,
          message: 'Enter your ATM PIN',
          description: 'First step: Verify your ATM PIN',
          subDescription: 'Enter the same PIN you use at ATM machines',
          badgeText: 'PIN Required',
          badgeVariant: 'outline' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'pin_verifying':
        return {
          icon: <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />,
          message: 'Verifying ATM PIN...',
          description: 'Checking your PIN with bank security',
          subDescription: 'This may take a few seconds',
          badgeText: 'Verifying PIN',
          badgeVariant: 'default' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'pin_verified':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />,
          message: 'PIN verified successfully!',
          description: 'Proceeding to biometric authentication',
          subDescription: 'Get ready for fingerprint or face authentication',
          badgeText: 'PIN Verified',
          badgeVariant: 'default' as const,
          bgColor: 'border-green-200 bg-green-50'
        };
      case 'fido_authenticating':
        return {
          icon: <Fingerprint className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-pulse" />,
          message: 'Waiting for biometric authentication...',
          description: 'Please complete authentication on your device',
          subDescription: 'Use your fingerprint, face, or PIN as prompted',
          badgeText: 'Biometric Authentication',
          badgeVariant: 'default' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'transaction_processing':
        return {
          icon: <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />,
          message: 'Processing secure transaction...',
          description: 'Both PIN and biometric verified - processing payment',
          subDescription: 'Fraud detection bypassed with enhanced authentication',
          badgeText: 'Processing Payment',
          badgeVariant: 'default' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />,
          message: 'Transaction completed successfully!',
          description: 'Your payment has been processed securely',
          subDescription: 'Redirecting to dashboard...',
          badgeText: 'Completed',
          badgeVariant: 'default' as const,
          bgColor: 'border-green-200 bg-green-50'
        };
      case 'failed':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />,
          message: 'Authentication failed',
          description: 'Unable to complete enhanced authentication',
          subDescription: 'You can try again or contact support',
          badgeText: 'Failed',
          badgeVariant: 'destructive' as const,
          bgColor: 'border-red-200 bg-red-50'
        };
      default:
        return {
          icon: <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />,
          message: 'Ready for enhanced authentication',
          description: 'PIN + Biometric verification required',
          subDescription: 'Two-factor authentication for maximum security',
          badgeText: 'Enhanced Security Protocol',
          badgeVariant: 'outline' as const,
          bgColor: 'border-gray-200 bg-gray-50'
        };
    }
  };

  const stepDisplay = getStepDisplay();

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Enhanced Security Verification</h3>
            <p className="text-sm text-gray-600">
              Complete your blocked transaction with PIN + biometric verification
            </p>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount:</span>
            <span className="font-bold text-lg">₹{transactionData.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">To Account:</span>
            <span className="font-mono text-sm">{transactionData.recipient_account_number}</span>
          </div>
          {currentAlert && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Security Alert ID:</span>
              <span className="font-mono text-xs">{currentAlert.id}</span>
            </div>
          )}
        </div>

        {/* Enhanced Security Notice */}
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Enhanced Security Required:</strong> This transaction requires both ATM PIN and biometric 
            authentication due to suspicious pattern detection. Both authentication methods must be completed 
            successfully for the transaction to proceed.
          </AlertDescription>
        </Alert>

        {/* PIN Entry Step */}
        {authStep === 'pin_entry' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="atm-pin">ATM PIN</Label>
              <div className="relative">
                <Input
                  id="atm-pin"
                  type={showPin ? "text" : "password"}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter your ATM PIN"
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
                Enter the same PIN you use at ATM machines (4-6 digits)
              </p>
              {attemptsRemaining !== null && (
                <p className="text-xs text-amber-600">
                  {attemptsRemaining} attempts remaining before lockout
                </p>
              )}
            </div>
          </div>
        )}

        {/* Authentication Step Display */}
        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${stepDisplay.bgColor}`}>
          {stepDisplay.icon}
          <h4 className="text-base font-medium text-gray-900 mb-2">
            {stepDisplay.message}
          </h4>
          <p className="text-sm text-gray-600 mb-1">
            {stepDisplay.description}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {stepDisplay.subDescription}
          </p>
          <Badge variant={stepDisplay.badgeVariant} className="text-xs">
            {stepDisplay.badgeText}
          </Badge>
        </div>

        {/* Error Display */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Error:</strong> {error}
              {error.includes("attempts") && (
                <p className="mt-2 text-sm">
                  Please double-check your ATM PIN and try again.
                </p>
              )}
              {error.includes("support") && (
                <p className="mt-2 text-sm">
                  Reference ID: {currentAlert?.id || 'Unknown'}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          {authStep === 'pin_entry' ? (
            <Button
              onClick={handlePinVerification}
              disabled={isLoading || !pinValue || pinValue.length < 4}
              className="flex-1 flex items-center justify-center space-x-2"
              size="lg"
            >
              <Lock className="w-4 h-4" />
              <span>
                {isLoading ? 'Verifying PIN...' : 'Verify PIN'}
              </span>
            </Button>
          ) : authStep === 'failed' ? (
            <Button
              onClick={resetAuthentication}
              className="flex-1 flex items-center justify-center space-x-2"
              size="lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </Button>
          ) : (
            <Button
              disabled={true}
              className="flex-1 flex items-center justify-center space-x-2"
              variant={authStep === 'completed' ? 'outline' : 'default'}
              size="lg"
            >
              <Fingerprint className="w-4 h-4" />
              <span>
                {authStep === 'pin_verifying' ? 'Verifying PIN...' :
                 authStep === 'pin_verified' ? 'PIN Verified ✓' :
                 authStep === 'fido_authenticating' ? 'Authenticating...' :
                 authStep === 'transaction_processing' ? 'Processing...' :
                 authStep === 'completed' ? 'Completed ✓' :
                 'Enhanced Authentication'}
              </span>
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
            size="lg"
          >
            Cancel
          </Button>
        </div>

        {/* Info Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Enhanced security: ATM PIN verification followed by biometric authentication
          </p>
          {currentAlert && (
            <p className="text-xs text-gray-400 mt-1">
              After successful dual authentication, fraud detection will be bypassed for this transaction
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};