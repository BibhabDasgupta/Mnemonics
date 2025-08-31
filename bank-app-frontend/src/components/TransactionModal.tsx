import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getOrSetTerminalId } from "@/utils/terminalId";
import { useToast } from "@/components/ui/use-toast";
import { useLocationContext } from "@/context/LocationContext";
import { useSecurityContext } from "@/context/SecurityContext";
import { SecurityService } from "@/services/securityService";
import { MapPin, Shield, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Clock } from "lucide-react";
import type { TransactionData } from "@/context/SecurityContext";
import { useAppContext } from "@/context/AppContext";
import { encrypt } from "@/utils/encryption";

interface Transaction {
  id: string;
  account_number: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  terminal_id: string;
}

interface Account {
  account_number: string;
  account_type: string;
  balance: number;
  customer_id: string;
  transactions: Transaction[];
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TransactionFormData {
  recipientName: string;
  recipientAccount: string;
  confirmAccount: string;
  amount: string;
  purpose: string;
}

type TransactionStep = "form" | "review" | "otp" | "processing";

export const TransactionModal = ({ isOpen, onClose }: TransactionModalProps) => {
  const { selectedAccount, setSelectedAccount, customerId } = useAppContext();
  const [currentStep, setCurrentStep] = useState<TransactionStep>("form");
  const [formData, setFormData] = useState<TransactionFormData>({
    recipientName: "",
    recipientAccount: "",
    confirmAccount: "",
    amount: "",
    purpose: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometricHash, setBiometricHash] = useState<string | null>(null);
  const [locationValidation, setLocationValidation] = useState<any>(null);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const { toast } = useToast();
  const { validateCurrentLocation, hasLocationPermission } = useLocationContext();
  const { triggerTransactionAlert } = useSecurityContext();

  // Timer effect for OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    if (isOpen && currentStep === "form") {
      const fetchBiometricState = async () => {
        try {
          const response = await fetch("http://localhost:5050/check_state");
          if (!response.ok) {
            throw new Error("Biometric checker service not available or failed.");
          }
          const data = await response.json();
          if (data.current_hash) {
            setBiometricHash(data.current_hash);
            console.log("Biometric state hash captured:", data.current_hash);
          } else {
            throw new Error("Could not retrieve biometric hash from checker.");
          }
        } catch (err: any) {
          console.error("Failed to fetch biometric state:", err);
          setError("Could not verify device security. Please ensure the checker is running.");
          toast({
            variant: "destructive",
            title: "Device Check Failed",
            description: err.message || "Could not connect to the biometric checker.",
          });
          setBiometricHash(null);
        }
      };
      fetchBiometricState();
    }
  }, [isOpen, currentStep, toast]);

  const validateFormData = (): boolean => {
    if (!formData.recipientName.trim()) {
      setError("Recipient name is required.");
      return false;
    }
    if (!formData.recipientAccount.trim()) {
      setError("Recipient account number is required.");
      return false;
    }
    if (formData.recipientAccount !== formData.confirmAccount) {
      setError("Account numbers do not match.");
      return false;
    }
    if (!formData.amount.trim() || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount.");
      return false;
    }
    if (!formData.purpose.trim()) {
      setError("Transaction purpose is required.");
      return false;
    }
    if (formData.recipientAccount === selectedAccount?.account_number) {
      setError("Cannot transfer to the same account.");
      return false;
    }
    return true;
  };

  const handleStepForward = async () => {
    setError("");

    if (currentStep === "form") {
      if (!validateFormData()) return;
      
      // Validate location
      console.log('🌍 [TransactionModal] Validating location before proceeding');
      const locationResult = await validateCurrentLocation();
      setLocationValidation(locationResult);

      if (locationResult?.is_suspicious && locationResult?.action === 'blocked') {
        toast({
          title: "Transaction Blocked",
          description: "Suspicious location activity detected. Please verify your identity.",
          variant: "destructive",
        });
        setError("Transaction blocked due to suspicious location activity.");
        return;
      }

      if (locationResult?.is_suspicious && locationResult?.action === 'warning') {
        setShowLocationWarning(true);
        toast({
          title: "Location Warning",
          description: locationResult.message,
          variant: "destructive",
        });
      }

      setCurrentStep("review");
    } else if (currentStep === "review") {
      await sendOTP();
    } else if (currentStep === "otp") {
      await handleTransaction();
    }
  };

  const fetchPhoneNumber = async (): Promise<string | null> => {
    if (!customerId) {
      setError("Customer ID not found. Please log in again.");
      return null;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/v1/customer/${customerId}/phone`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch phone number");
      }

      const data = await response.json();
      return data.phone_number;
    } catch (err: any) {
      setError(`Failed to fetch phone number: ${err.message}`);
      return null;
    }
  };

  const sendOTP = async () => {
    setIsLoading(true);
    try {
      const phoneNumber = await fetchPhoneNumber();
      if (!phoneNumber) {
        return; // Error already set in fetchPhoneNumber
      }

      const encryptedPhoneNumber = await encrypt(phoneNumber);
      
      const response = await fetch("http://localhost:8000/api/v1/transaction/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send OTP");
      }

      setOtpSent(true);
      setOtpTimer(30); // 30 second timer
      setCurrentStep("otp");
      toast({
        title: "OTP Sent",
        description: "Please check your phone for the verification code.",
      });
    } catch (err: any) {
      setError(`Failed to send OTP: ${err.message}`);
      toast({
        variant: "destructive",
        title: "OTP Failed",
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (): Promise<boolean> => {
    if (!otpCode.trim()) {
      setError("Please enter the OTP code.");
      return false;
    }

    try {
      const phoneNumber = await fetchPhoneNumber();
      if (!phoneNumber) {
        return false; // Error already set in fetchPhoneNumber
      }

      const encryptedPhoneNumber = await encrypt(phoneNumber);
      
      const response = await fetch("http://localhost:8000/api/v1/transaction/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_phone_number: encryptedPhoneNumber,
          otp_code: otpCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Invalid OTP");
      }

      return true;
    } catch (err: any) {
      setError(`OTP verification failed: ${err.message}`);
      return false;
    }
  };

  const handleTransaction = async () => {
    setIsLoading(true);
    setError("");
    setCurrentStep("processing");

    if (!biometricHash) {
      setError("Cannot proceed without a valid device security check.");
      setIsLoading(false);
      setCurrentStep("otp");
      return;
    }

    if (!selectedAccount) {
      setError("No account selected.");
      setIsLoading(false);
      setCurrentStep("otp");
      return;
    }

    // Verify OTP first
    const otpValid = await verifyOTP();
    if (!otpValid) {
      setIsLoading(false);
      setCurrentStep("otp");
      return;
    }

    try {
      const terminalId = getOrSetTerminalId();
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const parsedAmount = parseFloat(formData.amount);

      console.log('🔒 [TransactionModal] Initiating transaction with payload:', {
        recipient_account_number: formData.recipientAccount,
        amount: parsedAmount,
        terminal_id: terminalId,
        biometric_hash: biometricHash,
        account_number: selectedAccount.account_number,
      });

      const response = await fetch("http://localhost:8000/api/v1/transactions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_account_number: formData.recipientAccount,
          amount: parsedAmount,
          terminal_id: terminalId,
          biometric_hash: biometricHash,
          account_number: selectedAccount.account_number,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Transaction failed.");
      }

      const result = await response.json();
      console.log('🔒 [TransactionModal] Transaction response:', result);

      if (result.fraud_prediction && result.blocked) {
        console.log('🚨 [TransactionModal] Fraud detected - triggering security alert');
        const transactionData: TransactionData = {
          recipient_account_number: formData.recipientAccount,
          amount: parsedAmount,
          terminal_id: terminalId,
          biometric_hash: biometricHash,
        };
        const securityAlert = SecurityService.createTransactionAlert(result.fraud_details);
        triggerTransactionAlert(securityAlert, transactionData);
        handleClose();
        toast({
          title: "Transaction Blocked",
          description: "Suspicious activity detected. You will be redirected to security verification.",
          variant: "destructive",
        });
        return;
      }

      if (result.status === "Transaction successful") {
        // Fetch updated account details
        const accountResponse = await fetch(`http://localhost:8000/api/v1/account/${selectedAccount.account_number}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!accountResponse.ok) {
          throw new Error("Failed to fetch updated account details.");
        }

        const updatedAccount = await accountResponse.json();
        console.log('🔒 [TransactionModal] Updated account details:', updatedAccount);

        // Verify the transaction type - transactions are ordered by date desc, so latest is at index 0
        const latestTransaction = updatedAccount.transactions && updatedAccount.transactions.length > 0 
          ? updatedAccount.transactions[0] // Most recent transaction is at index 0
          : null;
        
        if (!latestTransaction) {
          console.error('No transactions found after transaction completion');
          throw new Error('Transaction may not have been recorded properly.');
        }

        console.log('🔒 [TransactionModal] Latest transaction:', latestTransaction);
        
        // Verify it's a debit transaction (money going out)
        if (latestTransaction.type !== 'debit') {
          console.error('Unexpected transaction type:', latestTransaction);
          throw new Error('Transaction recorded incorrectly. Expected a debit transaction.');
        }

        // Update the selected account in context
        setSelectedAccount(updatedAccount);
        handleClose();
        
        let successMessage = `₹${parsedAmount.toFixed(2)} transferred successfully to ${formData.recipientName}`;
        if (locationValidation?.is_suspicious) {
          successMessage += " Location verification was completed.";
        }
        toast({
          title: "Transaction Successful",
          description: successMessage,
          variant: "default",
        });

        if (result.fraud_probability && result.fraud_probability > 0.3) {
          toast({
            title: "Security Notice",
            description: `Transaction completed but flagged for review (${(result.fraud_probability * 100).toFixed(1)}% risk score)`,
            variant: "destructive",
          });
        }
      } else {
        throw new Error(result.message || 'Transaction failed');
      }
    } catch (err: any) {
      console.error('❌ [TransactionModal] Transaction error:', err);
      const errorMessage = err.message || "An unexpected error occurred.";
      setError(errorMessage);
      setCurrentStep("otp");
      toast({
        title: "Transaction Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepBack = () => {
    setError("");
    if (currentStep === "review") {
      setCurrentStep("form");
    } else if (currentStep === "otp") {
      setCurrentStep("review");
    }
  };

  const handleClose = () => {
    setCurrentStep("form");
    setFormData({
      recipientName: "",
      recipientAccount: "",
      confirmAccount: "",
      amount: "",
      purpose: "",
    });
    setOtpCode("");
    setError("");
    setBiometricHash(null);
    setLocationValidation(null);
    setShowLocationWarning(false);
    setOtpSent(false);
    setOtpTimer(0);
    onClose();
  };

  const renderFormStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <span>Send Money - Step 1 of 3</span>
          <div className="flex items-center space-x-1">
            <Shield className="w-4 h-4 text-green-600" />
            {hasLocationPermission && <MapPin className="w-4 h-4 text-blue-600" />}
            <Badge variant="outline" className="text-xs">AI Protected</Badge>
          </div>
        </DialogTitle>
        <DialogDescription>
          Enter recipient details. All fields are required for secure transfer.
        </DialogDescription>
      </DialogHeader>

      {showLocationWarning && locationValidation && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Location Notice:</strong> {locationValidation.message}
            {locationValidation.distance_km && (
              <span className="block text-sm mt-1">
                Distance from usual location: {locationValidation.distance_km.toFixed(1)}km
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Security Status:</span>
        <div className="flex items-center space-x-2">
          <Badge variant={biometricHash ? "secondary" : "destructive"} className="text-xs">
            {biometricHash ? "Device Verified" : "Pending"}
          </Badge>
          {hasLocationPermission && (
            <Badge
              variant={locationValidation?.is_suspicious ? "destructive" : locationValidation ? "secondary" : "outline"}
              className="text-xs"
            >
              {locationValidation?.is_suspicious ? "Location Alert" : locationValidation ? "Location Verified" : "Location Check"}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">Fraud AI</Badge>
        </div>
      </div>

      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="recipientName" className="text-right">Name</Label>
          <Input
            id="recipientName"
            placeholder="Recipient Name"
            value={formData.recipientName}
            onChange={(e) => setFormData({...formData, recipientName: e.target.value})}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="recipientAccount" className="text-right">Account No.</Label>
          <Input
            id="recipientAccount"
            type="password"
            placeholder="••••••••••"
            value={formData.recipientAccount}
            onChange={(e) => setFormData({...formData, recipientAccount: e.target.value})}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="confirmAccount" className="text-right">Confirm Account</Label>
          <Input
            id="confirmAccount"
            placeholder="Re-enter Account Number"
            value={formData.confirmAccount}
            onChange={(e) => setFormData({...formData, confirmAccount: e.target.value})}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="amount" className="text-right">Amount</Label>
          <Input
            id="amount"
            type="number"
            placeholder="₹0.00"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="purpose" className="text-right">Purpose</Label>
          <Input
            id="purpose"
            placeholder="Transfer Purpose"
            value={formData.purpose}
            onChange={(e) => setFormData({...formData, purpose: e.target.value})}
            className="col-span-3"
          />
        </div>
      </div>

      {error && <p className="text-sm text-center text-red-500 pb-2">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button
          variant="banking"
          onClick={handleStepForward}
          disabled={isLoading || !biometricHash}
        >
          <ArrowRight className="w-4 h-4 mr-1" />
          Review Details
        </Button>
      </DialogFooter>
    </>
  );

  const renderReviewStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <span>Review Transaction - Step 2 of 3</span>
          <Badge variant="outline" className="text-xs">Please Verify</Badge>
        </DialogTitle>
        <DialogDescription>
          Please review all transaction details carefully before proceeding.
        </DialogDescription>
      </DialogHeader>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">Transaction Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Recipient Name:</span>
            <span className="font-medium text-blue-900">{formData.recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Account Number:</span>
            <span className="font-medium text-blue-900">***{formData.recipientAccount.slice(-4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Amount:</span>
            <span className="font-medium text-blue-900 text-lg">₹{parseFloat(formData.amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Purpose:</span>
            <span className="font-medium text-blue-900">{formData.purpose}</span>
          </div>
          <div className="border-t border-blue-300 pt-2">
            <div className="flex justify-between">
              <span className="text-blue-700">From Account:</span>
              <span className="font-medium text-blue-900">***{selectedAccount?.account_number.slice(-4)}</span>
            </div>
          </div>
        </div>
      </Card>

      {locationValidation && locationValidation.location && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Transaction Location</span>
          </div>
          <div className="text-xs text-blue-700 space-y-1">
            <div>Location: {locationValidation.location.city || 'Unknown'}, {locationValidation.location.country || 'Unknown'}</div>
            <div>Source: {locationValidation.location.source?.toUpperCase() || 'Unknown'}</div>
            {locationValidation.distance_km !== undefined && (
              <div>Distance from usual: {locationValidation.distance_km.toFixed(1)}km</div>
            )}
          </div>
        </div>
      )}

      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center space-x-2 mb-1">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-900">Security Verification</span>
        </div>
        <div className="text-xs text-green-700">
          Next step: OTP will be sent to your registered mobile number for final verification.
        </div>
      </div>

      {error && <p className="text-sm text-center text-red-500 pb-2">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={handleStepBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Edit Details
        </Button>
        <Button
          variant="banking"
          onClick={handleStepForward}
          disabled={isLoading}
        >
          {isLoading ? "Sending OTP..." : "Send OTP & Proceed"}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderOTPStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <span>OTP Verification - Step 3 of 3</span>
          <Badge variant="secondary" className="text-xs">Final Step</Badge>
        </DialogTitle>
        <DialogDescription>
          Enter the OTP sent to your registered mobile number to complete the transaction.
        </DialogDescription>
      </DialogHeader>

      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-center space-x-2 mb-2">
          <CheckCircle className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-amber-900">OTP Sent Successfully</span>
        </div>
        <p className="text-sm text-amber-700">
          A 6-digit verification code has been sent to your registered mobile number.
          {otpTimer > 0 && (
            <span className="block mt-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Resend OTP in {otpTimer} seconds
            </span>
          )}
        </p>
      </Card>

      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="otpCode" className="text-right">OTP Code</Label>
          <Input
            id="otpCode"
            type="number"
            placeholder="Enter 6-digit OTP"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.slice(0, 6))}
            className="col-span-3 text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>
      </div>

      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center space-x-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-900">Final Confirmation</span>
        </div>
        <div className="text-xs text-red-700">
          Once you proceed with the correct OTP, ₹{parseFloat(formData.amount).toFixed(2)} will be transferred to {formData.recipientName}.
        </div>
      </div>

      {error && <p className="text-sm text-center text-red-500 pb-2">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={handleStepBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Review
        </Button>
        <Button
          variant="banking"
          onClick={handleStepForward}
          disabled={isLoading || !otpCode.trim() || otpCode.length !== 6}
        >
          {isLoading ? "Processing..." : "Complete Transaction"}
          <CheckCircle className="w-4 h-4 ml-1" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderProcessingStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <span>Processing Transaction</span>
        </DialogTitle>
        <DialogDescription>
          Please wait while we process your transaction. Do not close this window.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4" />
        <p className="text-lg font-medium text-center">Processing your transaction...</p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Verifying OTP and executing transfer of ₹{parseFloat(formData.amount).toFixed(2)}
        </p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {currentStep === "form" && renderFormStep()}
        {currentStep === "review" && renderReviewStep()}
        {currentStep === "otp" && renderOTPStep()}
        {currentStep === "processing" && renderProcessingStep()}
      </DialogContent>
    </Dialog>
  );
};