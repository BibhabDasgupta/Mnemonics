// --- File: src/pages/SecurityVerificationPage.tsx ---
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityContext } from '@/context/SecurityContext';
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
} from 'lucide-react';
import bankLogo from '@/assets/bank-logo.png';

const SecurityVerificationPage = () => {
  const navigate = useNavigate();
  const { currentAlert, clearAlert } = useSecurityContext();

  useEffect(() => {
    // Check for stored alert on page load
    const storedAlert = sessionStorage.getItem('security_alert');
    if (storedAlert && !currentAlert) {
      // Redirect if no current alert but stored alert exists
      navigate('/dashboard', { replace: true });
    }
  }, [currentAlert, navigate]);

  if (!currentAlert) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleReturnToLogin = () => {
    clearAlert();
    sessionStorage.removeItem('security_alert');
    document.cookie = 'auth_token=; max-age=0; path=/; Secure; SameSite=Strict';
    navigate('/login', { replace: true });
  };

  const handleContactSupport = () => {
    // In a real app, this would open a support modal or redirect to support
    alert('Support contact functionality would be implemented here');
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
            <img src={bankLogo} alt="GlowBank" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">GlowBank Security</h1>
              <p className="text-xs text-gray-600">Account Protection Active</p>
            </div>
          </div>
          <Badge variant="destructive" className="animate-pulse">
            <Shield className="w-3 h-3 mr-1" />
            SECURITY ALERT
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          
          {/* Alert Header */}
          <Card className="p-6 border-red-200 bg-white/90">
            <div className="flex items-center space-x-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRiskColor(currentAlert.riskLevel)}`}>
                <RiskIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Security Alert Detected</h2>
                <p className="text-gray-600">Suspicious behavioral patterns have been identified</p>
              </div>
              <Badge 
                variant="destructive" 
                className="text-sm px-3 py-1"
              >
                {currentAlert.riskLevel} RISK
              </Badge>
            </div>

            <Alert className="border-red-200 bg-red-50">
              <Ban className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Account Access Temporarily Restricted</strong> - Please complete security verification to continue.
              </AlertDescription>
            </Alert>
          </Card>

          {/* Detection Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Fraud Detection Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Fraud Detection Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Detection Type:</span>
                  <Badge variant="outline">{currentAlert.anomalyType}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Risk Level:</span>
                  <Badge 
                    className={`${getRiskColor(currentAlert.riskLevel)} text-white`}
                  >
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
                  <span className="text-sm text-gray-600">Transaction Status:</span>
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

          {/* Action Buttons */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
            <p className="text-gray-600 mb-6">
              To regain access to your account, please choose one of the following options:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button 
                onClick={handleReturnToLogin}
                className="flex items-center justify-center space-x-2"
                variant="default"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Login</span>
              </Button>
              
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
            </div>
          </Card>

          {/* Technical Details (Debug Info) */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">Technical Details</summary>
            <Card className="mt-2 p-4 bg-gray-50">
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {JSON.stringify(currentAlert, null, 2)}
              </pre>
            </Card>
          </details>
        </div>
      </main>
    </div>
  );
};

export default SecurityVerificationPage;