import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { encrypt } from "@/utils/encryption";
import { useNavigate } from "react-router-dom";

interface RestorationPhoneStepProps {
  title: string;
  onBack: () => void;
  onProceed: (phoneNumber: string, status?: string, customerId?: string) => void;
  phoneNumber?: string;
  error: string;
  setError: (error: string) => void;
}

const RestorationPhoneStep = ({
  title,
  onBack,
  onProceed,
  phoneNumber: initialPhoneNumber,
  error,
  setError,
}: RestorationPhoneStepProps) => {
  // Extract digits from initial phone number if it includes +91
  const getPhoneDigits = (phone?: string) => {
    if (!phone) return "";
    return phone.startsWith("+91") ? phone.slice(3) : phone;
  };

  const [phoneDigits, setPhoneDigits] = useState(getPhoneDigits(initialPhoneNumber));
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handlePhoneDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits and limit to 10 characters
    if (/^\d*$/.test(value) && value.length <= 10) {
      setPhoneDigits(value);
      setError(""); // Clear error when user starts typing
    }
  };

  const getFullPhoneNumber = () => {
    return `+91${phoneDigits}`;
  };

  const handleRestorationSubmit = async () => {
    setIsLoading(true);
    setError("");
    
    // Validate phone number
    if (phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      setIsLoading(false);
      return;
    }

    try {
      const fullPhoneNumber = getFullPhoneNumber();
      const encryptedPhoneNumber = await encrypt(fullPhoneNumber);
      
      const response = await fetch("http://localhost:8000/api/v1/restore/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted_phone_number: encryptedPhoneNumber
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to check phone number");
      }

      const data = await response.json();
      onProceed(data.phone_number || fullPhoneNumber, data.status, data.customer_id);
    } catch (err: any) {
      if (err.message.includes("App access is revoked")) {
        setError("Account access revoked. Please visit a branch to re-register.");
        onProceed(getFullPhoneNumber(), "revoked");
      } else if (err.message.includes("not registered")) {
        setError("Phone number not registered. Please register first.");
        onProceed(getFullPhoneNumber(), "new");
      } else {
        setError(err.message || "Error checking phone number");
        onProceed(getFullPhoneNumber(), "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneDigits.trim() && phoneDigits.length === 10) {
      await handleRestorationSubmit();
    }
  };

  const handleGoToRegistration = () => {
    setError("");
    navigate("/landing");
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
                disabled={isLoading}
                maxLength={10}
                pattern="[0-9]{10}"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Please enter your registered mobile number
            </p>
          </div>
          
          {error && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">
                {error}
              </p>
              {(error.includes("not registered") || error.includes("Error checking phone number")) && (
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
                  className="w-full"
                  onClick={handleGoToRegistration}
                >
                  Go to Registration
                </Button>
              )}
            </div>
          )}
          
          <Button
            type="submit"
            variant="banking"
            size="xl"
            className="w-full"
            disabled={isLoading || !phoneDigits.trim() || phoneDigits.length !== 10}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">↻</span>
                Processing...
              </span>
            ) : "Submit"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default RestorationPhoneStep;