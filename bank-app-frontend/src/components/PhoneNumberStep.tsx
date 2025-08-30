import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { encrypt } from "@/utils/encryption";
import * as ed25519 from '@noble/ed25519';
import { useNavigate } from "react-router-dom";

interface PhoneNumberStepProps {
  title: string;
  onBack: () => void;
  onProceed: (phoneNumber: string, status?: string, customerId?: string) => void;
  phoneNumber?: string;
  error: string;
  setError: (error: string) => void;
  isOTP: boolean;
}

const PhoneNumberStep = ({
  title,
  onBack,
  onProceed,
  phoneNumber: initialPhoneNumber,
  error,
  setError,
  isOTP
}: PhoneNumberStepProps) => {
  // Extract the 10-digit number from initial phone number (remove +91 if present)
  const getInitialNumber = (phone?: string) => {
    if (!phone) return "";
    // Remove +91, 91, or any non-digits and take last 10 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
      return digitsOnly.slice(2);
    }
    return digitsOnly.slice(-10);
  };

  const [phoneDigits, setPhoneDigits] = useState(getInitialNumber(initialPhoneNumber));
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ephemeralPublicKey, setEphemeralPublicKey] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const isRestoration = title.includes("Restoration");

  // Get complete phone number with country code
  const getCompletePhoneNumber = () => {
    return phoneDigits ? `+91${phoneDigits}` : "";
  };

  const generateEphemeralKey = async () => {
    try {
      const privateKey = await ed25519.utils.randomPrivateKey();
      const publicKey = await ed25519.getPublicKey(privateKey);
      const pubKeyHex = Buffer.from(publicKey).toString('hex');
      setEphemeralPublicKey(pubKeyHex);
      return pubKeyHex;
    } catch (err) {
      setError("Error generating encryption key");
      throw err;
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    setIsLoading(true);
    setError("");
    try {
      const completePhoneNumber = getCompletePhoneNumber();
      const encryptedPhoneNumber = await encrypt(completePhoneNumber);
      const response = await fetch("http://localhost:8000/api/v1/register/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_phone_number: encryptedPhoneNumber
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.detail || "Failed to send OTP");
      }

      setOtpSent(true);
      startCountdown();
      setError("OTP sent successfully. Check your phone!");
      onProceed(responseData.phone_number || completePhoneNumber, responseData.status, responseData.customer_id);
    } catch (err: any) {
      if (err.message.includes("already registered")) {
        setError("Phone number already registered. Please proceed to restoration.");
      } else if (err.message.includes("access revoked")) {
        setError("Account access revoked. Please visit a branch to re-register.");
      } else {
        setError(err.message || "Error sending OTP");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    await handleSendOTP();
  };

  const handleRestorationSubmit = async () => {
    setIsLoading(true);
    setError("");
    try {
      const ephemeralPubKey = await generateEphemeralKey();
      const completePhoneNumber = getCompletePhoneNumber();
      const encryptedPhoneNumber = await encrypt(completePhoneNumber);
      
      const response = await fetch("http://localhost:8000/api/v1/restoration/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_phone_number: encryptedPhoneNumber,
          ephemeral_public_key: ephemeralPubKey
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to check phone number");
      }

      const data = await response.json();
      onProceed(data.phone_number || completePhoneNumber, data.status, data.customer_id);
    } catch (err: any) {
      if (err.message.includes("App access is revoked")) {
        setError("Account access revoked. Please visit a branch to re-register.");
        onProceed(getCompletePhoneNumber(), "revoked");
      } else if (err.message.includes("Phone number not registered")) {
        setError("Phone number not registered. Please register first.");
        onProceed(getCompletePhoneNumber(), "new");
      } else {
        setError(err.message || "Error checking phone number");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerification = async () => {
    setIsLoading(true);
    setError("");
    try {
      const completePhoneNumber = getCompletePhoneNumber();
      const encryptedPhoneNumber = await encrypt(completePhoneNumber);
      const response = await fetch("http://localhost:8000/api/v1/register/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_phone_number: encryptedPhoneNumber,
          ephemeral_public_key: ephemeralPublicKey,
          otp_code: otpCode
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.detail || "Invalid OTP");
      }

      setOtpCode("");
      setOtpSent(false);
      
      setTimeout(() => {
        onProceed(responseData.phone_number || completePhoneNumber, "verified", responseData.customer_id);
      }, 0);
      
    } catch (err: any) {
      if (err.message.includes("already registered")) {
        setError("Phone number already registered. Please proceed to restoration.");
      } else if (err.message.includes("access revoked")) {
        setError("Account access revoked. Please visit a branch to re-register.");
      } else {
        setError(err.message || "Error verifying OTP");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestoration && phoneDigits.trim()) {
      await handleRestorationSubmit();
    } else if (!otpSent && phoneDigits.trim()) {
      await handleSendOTP();
    } else if ((otpSent || isOTP) && otpCode.trim()) {
      await handleOTPVerification();
    }
  };

  const handlePhoneDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    if (value.length <= 10) {
      setPhoneDigits(value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              {/* Country Code - Fixed +91 */}
              <div className="flex items-center justify-center bg-muted px-3 rounded-md border h-12 min-w-[70px]">
                <span className="text-foreground font-medium">+91</span>
              </div>
              
              {/* 10-digit phone number input */}
              <Input
                id="phone"
                type="tel"
                placeholder="Enter 10-digit number"
                value={phoneDigits}
                onChange={handlePhoneDigitsChange}
                className="h-12 flex-1"
                required
                disabled={otpSent || isLoading}
                maxLength={10}
                pattern="[0-9]{10}"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Please enter your registered 10-digit mobile number
            </p>
          </div>
          
          {(otpSent || (isOTP && !isRestoration)) && (
            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <div className="flex gap-2">
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      setOtpCode(value);
                    }
                  }}
                  className="h-12 flex-1"
                  required
                  disabled={isLoading}
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || isLoading}
                  className="h-12"
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the OTP sent to {getCompletePhoneNumber()}
              </p>
            </div>
          )}
          
          {error && (
            <p className={`text-sm ${error.includes("successfully") ? "text-green-600" : "text-red-600"}`}>
              {error}
            </p>
          )}
          
          <Button
            type="submit"
            variant="banking"
            size="xl"
            className="w-full"
            disabled={
              isLoading ||
              phoneDigits.length !== 10 ||
              ((otpSent || isOTP) && otpCode.length !== 6)
            }
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">↻</span>
                Processing...
              </span>
            ) : isRestoration ? "Submit" :
               otpSent ? "Verify OTP" : "Send OTP"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default PhoneNumberStep;