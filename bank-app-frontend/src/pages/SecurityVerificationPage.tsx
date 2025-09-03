// --- File: src/pages/SecurityVerificationPage.tsx ---
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityContext } from '@/context/SecurityContext';
import { TransactionRetry } from '@/components/TransactionRetry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  AlertTriangle,
  Ban,
  TrendingUp,
  ArrowLeft,
  Phone,
  RefreshCw,
  Eye,
  CreditCard,
  Clock,
  DollarSign,
  MapPin,
  Smartphone,
} from 'lucide-react';
import bankLogo from '@/assets/bank-logo.png';

const SecurityVerificationPage = () => {
  const navigate = useNavigate();
  const { currentAlert, clearAlert, pendingTransaction } = useSecurityContext();
  const isTransactionAlert = currentAlert?.transactionDetails?.type === 'TRANSACTION_FRAUD';
  const [showTransactionRetry, setShowTransactionRetry] = useState(false);
  
  useEffect(() => {
    // Check for stored alert on page load
    const storedAlert = sessionStorage.getItem('security_alert');
    if (storedAlert && !currentAlert) {
      try {
        const parsedAlert = JSON.parse(storedAlert);
        // If we have a stored alert but no current alert, redirect to login
        console.log('🔒 [SecurityVerificationPage] Found stored alert but no current alert, redirecting to login');
        navigate('/login', { replace: true });
      } catch (error) {
        console.error('Failed to parse stored alert:', error);
        sessionStorage.removeItem('security_alert');
        navigate('/login', { replace: true });
      }
    }

    // Log current state for debugging
    console.log('🔒 [SecurityVerificationPage] Current state:', {
      hasCurrentAlert: !!currentAlert,
      isTransactionAlert,
      hasPendingTransaction: !!pendingTransaction
    });
  }, [currentAlert, navigate, isTransactionAlert, pendingTransaction]);

  if (!currentAlert) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleReturnToLogin = () => {
    console.log('🔒 [SecurityVerificationPage] Returning to login');
    clearAlert();
    document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
    navigate('/login', { replace: true });
  };

  const handleRetryTransaction = () => {
    console.log('🔒 [SecurityVerificationPage] Retrying transaction (redirecting to login)');
    clearAlert();
    navigate('/login', { replace: true });
  };

  const handleContinueTransaction = () => {
    console.log('💳 [SecurityVerificationPage] Showing transaction retry component');
    setShowTransactionRetry(true);
  };

  const handleTransactionSuccess = () => {
    console.log('✅ [SecurityVerificationPage] Transaction completed successfully');
    // Transaction completed successfully
    clearAlert();
    navigate('/dashboard');
  };

  const handleTransactionCancel = () => {
    console.log('❌ [SecurityVerificationPage] Transaction retry cancelled');
    setShowTransactionRetry(false);
  };

  const handleContactSupport = () => {
    // Enhanced support contact with alert context
    const alertSummary = {
      alertId: currentAlert.id,
      riskLevel: currentAlert.riskLevel,
      anomalyType: currentAlert.anomalyType,
      timestamp: currentAlert.timestamp,
      isTransaction: isTransactionAlert,
      hasPendingTransaction: !!pendingTransaction
    };
    
    console.log('📞 [SecurityVerificationPage] Support contact initiated with context:', alertSummary);
    
    // In a real app, this would:
    // 1. Open a support chat with pre-filled context
    // 2. Create a support ticket automatically
    // 3. Send alert details to support team
    alert(`Support contacted. Reference ID: ${currentAlert.id}\n\nA support representative will contact you shortly.`);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'HIGH': return AlertTriangle;
      case 'MEDIUM': return Shield;
      case 'LOW': return Eye;
      default: return Shield;
    }
  };

  const RiskIcon = getRiskIcon(currentAlert.riskLevel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-red-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto p-4">
          <div className="flex items-center space-x-3">
            <img src={bankLogo} alt="DhanRakshak" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">DhanRakshak Security</h1>
              <p className="text-xs text-gray-600">
                {isTransactionAlert ? 'Transaction Protection Active' : 'Account Protection Active'}
              </p>
            </div>
          </div>
          <Badge variant="destructive" className="animate-pulse">
            <Shield className="w-3 h-3 mr-1" />
            {isTransactionAlert ? 'TRANSACTION BLOCKED' : 'SECURITY ALERT'}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          
          {/* Alert Header - Enhanced for Transaction Alerts */}
          <Card className="p-6 border-red-200 bg-white/90">
            <div className="flex items-center space-x-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRiskColor(currentAlert.riskLevel)}`}>
                {isTransactionAlert ? <CreditCard className="w-6 h-6 text-white" /> : <RiskIcon className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isTransactionAlert ? 'Transaction Blocked by AI Fraud Detection' : 'Security Alert Detected'}
                </h2>
                <p className="text-gray-600">
                  {isTransactionAlert 
                    ? 'Your transaction has been blocked due to suspicious patterns detected by our AI system'
                    : 'Suspicious behavioral patterns have been identified'
                  }
                </p>
              </div>
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {currentAlert.riskLevel} RISK
              </Badge>
            </div>

            <Alert className="border-red-200 bg-red-50">
              <Ban className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>
                  {isTransactionAlert ? 'Transaction Blocked' : 'Account Access Temporarily Restricted'}
                </strong> - Please complete security verification to continue.
                {isTransactionAlert && (
                  <span className="block mt-1 text-sm">
                    No funds have been transferred. Your account balance is unchanged.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </Card>

          {/* Transaction-specific details - Enhanced */}
          {isTransactionAlert && pendingTransaction && (
            <Card className="p-6 border-orange-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-red-600" />
                Blocked Transaction Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Transaction Details */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Transaction Information</h4>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="font-medium text-lg">₹{pendingTransaction.amount.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Recipient Account:</span>
                    <span className="font-mono text-sm">{pendingTransaction.recipient_account_number}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Terminal ID:</span>
                    <span className="font-mono text-xs">{pendingTransaction.terminal_id}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Blocked Time:</span>
                    <span className="text-sm">
                      {new Date(currentAlert.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Detection Summary */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">AI Detection Summary</h4>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">ML Features Analyzed:</span>
                    <Badge variant="outline" className="text-xs">
                      {currentAlert.transactionDetails?.features?.length || 15} factors
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fraud Probability:</span>
                    <span className="font-medium text-red-600">
                      {currentAlert.confidence.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Decision Score:</span>
                    <span className="font-mono text-sm">
                      {currentAlert.decision_score?.toFixed(6) || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Risk Level:</span>
                    <Badge className={`${getRiskColor(currentAlert.riskLevel)} text-white text-xs`}>
                      {currentAlert.riskLevel}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />
              
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">AI Analysis Details</h5>
                <p className="text-xs text-blue-700">
                  Our machine learning system analyzed transaction patterns, amounts, timing, behavioral factors, 
                  and historical data to identify this transaction as potentially fraudulent. The analysis considered 
                  {currentAlert.transactionDetails?.features?.length || 15} different risk factors in real-time.
                </p>
              </div>
            </Card>
          )}

          {/* Detection Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Fraud Detection Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                {isTransactionAlert ? 'AI Fraud Detection' : 'Fraud Detection Status'}
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Detection Type:</span>
                  <Badge variant="outline">{currentAlert.anomalyType}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Risk Level:</span>
                  <Badge className={`${getRiskColor(currentAlert.riskLevel)} text-white`}>
                    {currentAlert.riskLevel}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Confidence:</span>
                  <span className="font-medium">{currentAlert.confidence.toFixed(1)}%</span>
                </div>
                
                {currentAlert.decision_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Decision Score:</span>
                    <span className="font-mono text-sm">{currentAlert.decision_score.toFixed(6)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge variant="destructive">
                    <Ban className="w-3 h-3 mr-1" />
                    BLOCKED
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Alert Time:</span>
                  <span className="text-sm">
                    {new Date(currentAlert.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Security Recommendations */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-600" />
                Security Recommendations
              </h3>
              
              <div className="space-y-3">
                {currentAlert.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{recommendation}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Action Buttons - Enhanced for Transaction Alerts */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
            <p className="text-gray-600 mb-6">
              {isTransactionAlert 
                ? 'Your transaction has been safely blocked. Choose an option below to proceed:'
                : 'To regain access to your account, please choose one of the following options:'
              }
            </p>
            
            {showTransactionRetry && pendingTransaction ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium">Continue Blocked Transaction</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleTransactionCancel}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </Button>
                </div>
                <TransactionRetry
                  transactionData={pendingTransaction}
                  onSuccess={handleTransactionSuccess}
                  onCancel={handleTransactionCancel}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isTransactionAlert ? (
                  <Button 
                    onClick={handleReturnToLogin}
                    className="flex items-center justify-center space-x-2"
                    variant="outline"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Login</span>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleReturnToLogin}
                    className="flex items-center justify-center space-x-2"
                    variant="default"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Login</span>
                  </Button>
                )}
                
                <Button 
                  onClick={handleContactSupport}
                  variant="outline"
                  className="flex items-center justify-center space-x-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Contact Support</span>
                </Button>
                
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Verification</span>
                </Button>

                {isTransactionAlert && pendingTransaction && (
                  <Button 
                    onClick={handleContinueTransaction}
                    variant="default"
                    className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Continue Transaction</span>
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Technical Details (Debug Info) */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">Technical Details (Debug)</summary>
            <Card className="mt-2 p-4 bg-gray-50">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Current Alert:</span>
                  <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto mt-1">
                    {JSON.stringify(currentAlert, null, 2)}
                  </pre>
                </div>
                {pendingTransaction && (
                  <div>
                    <span className="font-semibold">Pending Transaction:</span>
                    <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto mt-1">
                      {JSON.stringify(pendingTransaction, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          </details>
        </div>
      </main>
    </div>
  );
};

export default SecurityVerificationPage;