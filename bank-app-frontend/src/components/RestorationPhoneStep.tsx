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
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRestorationSubmit = async () => {
    setIsLoading(true);
    setError("");
    try {
      const encryptedPhoneNumber = await encrypt(phoneNumber); // Use same encrypt function as registration
      
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
      onProceed(data.phone_number, data.status, data.customer_id);
    } catch (err: any) {
      if (err.message.includes("App access is revoked")) {
        setError("Account access revoked. Please visit a branch to re-register.");
        onProceed(phoneNumber, "revoked");
      } else if (err.message.includes("not registered")) {
        setError("Phone number not registered. Please register first.");
        onProceed(phoneNumber, "new");
      } else {
        setError(err.message || "Error checking phone number");
        onProceed(phoneNumber, "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
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
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value;
                // Enforce phone number format (e.g., +1234567890 or 1234567890)
                if (/^\+?\d{0,12}$/.test(value)) {
                  setPhoneNumber(value);
                }
              }}
              className="h-12"
              required
              disabled={isLoading}
            />
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
            disabled={isLoading || !phoneNumber.trim()}
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