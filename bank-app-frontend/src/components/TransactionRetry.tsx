// --- File: src/components/TransactionRetry.tsx ---
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { TransactionService, TransactionData } from '@/services/transactionService';
import { useSecurityContext } from '@/context/SecurityContext';
import { useNavigate } from 'react-router-dom';
import { Shield, CreditCard, Fingerprint, AlertTriangle, RefreshCw, CheckCircle, User } from 'lucide-react';

interface TransactionRetryProps {
  transactionData: TransactionData;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TransactionRetry = ({ transactionData, onSuccess, onCancel }: TransactionRetryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStep, setAuthStep] = useState<'ready' | 'authenticating' | 'processing' | 'completed'>('ready');
  const { toast } = useToast();
  const { clearAlert, currentAlert } = useSecurityContext();
  const navigate = useNavigate();

  const handleRetryWithAuth = async () => {
    setIsLoading(true);
    setError('');
    setAuthStep('ready');

    try {
      console.log('🔐 [TransactionRetry] Starting FIDO2 authentication for transaction retry');
      
      // Get the original alert ID from security context if available
      const originalAlertId = currentAlert?.id;
      
      console.log('📋 [TransactionRetry] Transaction details:', {
        amount: transactionData.amount,
        recipient: transactionData.recipient_account_number,
        originalAlertId: originalAlertId || 'N/A'
      });
      
      setAuthStep('authenticating');
      toast({
        title: "Biometric Authentication Required",
        description: "Please authenticate using your fingerprint, face, or PIN to continue the transaction.",
        variant: "default",
      });

      // Pass the original alert ID for audit trail
      const result = await TransactionService.executeWithFIDO2Auth(transactionData, originalAlertId);

      setAuthStep('processing');

      console.log('📊 [TransactionRetry] Transaction result:', {
        status: result.status,
        blocked: result.blocked || false,
        fraudDetectionBypassed: result.fraud_detection_bypassed || false,
        isReauth: result.is_reauth_transaction || false
      });

      // Check for successful transaction (should succeed with fraud detection bypass)
      if (result.status === "Transaction successful") {
        setAuthStep('completed');
        
        let successMessage = `Your transaction has been completed successfully!`;
        if (result.fraud_detection_bypassed) {
          successMessage += ` (Fraud detection bypassed after authentication)`;
        }
        successMessage += ` New balance: ₹${result.new_balance.toLocaleString()}`;
        
        toast({
          title: "Transaction Successful!",
          description: successMessage,
          variant: "default",
        });

        console.log('🎉 [TransactionRetry] Transaction completed successfully:', {
          newBalance: result.new_balance,
          fraudBypassed: result.fraud_detection_bypassed,
          securityNotice: result.security_notice
        });

        // Show success state briefly, then redirect
        setTimeout(() => {
          clearAlert();
          navigate('/dashboard');
          onSuccess();
        }, 2000);
        
      } else if (result.fraud_prediction && result.blocked) {
        // This should rarely happen now with fraud detection bypass, but handle just in case
        setAuthStep('ready');
        console.error('🚨 [TransactionRetry] Transaction still blocked despite re-authentication:', result);
        
        toast({
          title: "Unusual Security Issue",
          description: "Despite successful authentication, this transaction requires additional review. Please contact support.",
          variant: "destructive",
        });
        setError("Transaction requires additional security review despite successful authentication. Please contact our support team.");
        
      } else {
        // Handle other failure cases
        throw new Error(result.message || result.detail || 'Transaction failed unexpectedly');
      }

    } catch (err: any) {
      console.error('❌ [TransactionRetry] Authentication/Transaction failed:', err);
      setAuthStep('ready');
      
      const errorMessage = err.message || "Transaction retry failed";
      setError(errorMessage);
      
      // Handle specific error cases with appropriate user messaging
      if (errorMessage.includes("cancelled") || errorMessage.includes("user cancelled")) {
        toast({
          title: "Authentication Cancelled",
          description: "Biometric authentication was cancelled. Please try again when ready.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("not available") || errorMessage.includes("not supported")) {
        toast({
          title: "Biometric Authentication Unavailable",
          description: "Biometric authentication is not available on this device. Please contact support.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("Authentication") || 
                 errorMessage.includes("Session expired") || 
                 errorMessage.includes("log in") ||
                 errorMessage.includes("token")) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. You will be redirected to login.",
          variant: "destructive",
        });
        
        // Clear everything and redirect to login after delay
        setTimeout(() => {
          clearAlert();
          document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
          navigate('/login', { replace: true });
        }, 2000);
      } else if (errorMessage.includes("Customer information not found")) {
        toast({
          title: "Account Information Missing",
          description: "Your account information is missing. Please log in again.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          clearAlert();
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        // Generic error handling
        toast({
          title: "Transaction Failed",
          description: errorMessage.length > 100 ? "An error occurred during transaction processing. Please try again." : errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      if (authStep !== 'completed') {
        setIsLoading(false);
      }
    }
  };

  const getStepDisplay = () => {
    switch (authStep) {
      case 'authenticating':
        return {
          icon: <Fingerprint className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-pulse" />,
          message: 'Waiting for biometric authentication...',
          description: 'Please complete authentication on your device',
          subDescription: 'Use your fingerprint, face, or PIN as prompted',
          badgeText: 'Authenticating',
          badgeVariant: 'default' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'processing':
        return {
          icon: <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />,
          message: 'Processing transaction...',
          description: 'Authentication successful, processing your transaction',
          subDescription: 'Fraud detection bypassed - transaction should complete',
          badgeText: 'Processing',
          badgeVariant: 'default' as const,
          bgColor: 'border-blue-200 bg-blue-50'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />,
          message: 'Transaction completed successfully!',
          description: 'Your transaction has been processed',
          subDescription: 'Redirecting to dashboard...',
          badgeText: 'Completed',
          badgeVariant: 'default' as const,
          bgColor: 'border-green-200 bg-green-50'
        };
      default:
        return {
          icon: <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />,
          message: 'Ready for enhanced authentication',
          description: 'Biometric verification required to continue',
          subDescription: 'This will open your device\'s authentication prompt',
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
            <h3 className="text-lg font-semibold">Continue Transaction</h3>
            <p className="text-sm text-gray-600">
              Complete your blocked transaction with enhanced verification
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

        {/* Security Notice */}
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Enhanced Security Required:</strong> This transaction requires fresh biometric authentication 
            due to suspicious pattern detection. Your device will prompt for authentication, and fraud detection 
            will be bypassed after successful verification.
          </AlertDescription>
        </Alert>

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
              {error.includes("cancelled") && (
                <p className="mt-2 text-sm">
                  You can try authentication again when ready.
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
          <Button
            onClick={handleRetryWithAuth}
            disabled={isLoading || authStep === 'completed'}
            className="flex-1 flex items-center justify-center space-x-2"
            variant={authStep === 'completed' ? 'outline' : 'default'}
            size="lg"
          >
            <Fingerprint className="w-4 h-4" />
            <span>
              {authStep === 'authenticating' ? 'Authenticating...' :
               authStep === 'processing' ? 'Processing...' :
               authStep === 'completed' ? 'Completed ✓' :
               'Verify & Continue'}
            </span>
          </Button>
          
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
            Your device will prompt for biometric authentication (Windows Hello, TouchID, or PIN)
          </p>
          {currentAlert && (
            <p className="text-xs text-gray-400 mt-1">
              After successful authentication, fraud detection will be bypassed for this transaction
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};