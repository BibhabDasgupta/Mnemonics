import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { encrypt } from "@/utils/encryption";
import { getMockData, MockData } from "@/utils/mockData";

interface DeviceVerificationProps {
  onBack: () => void;
  onProceed: () => void;
  phoneNumber: string;
  customerId?: string;
}

const DeviceVerification = ({ onBack, onProceed, phoneNumber, customerId }: DeviceVerificationProps) => {
  const [simCheckStatus, setSimCheckStatus] = useState<'pending' | 'success' | 'failed' | 'update_required'>('pending');
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<'pending' | 'success' | 'failed' | 'update_required'>('pending');
  const [error, setError] = useState("");
  const [isLoadingSim, setIsLoadingSim] = useState(false);
  const [isLoadingPhone, setIsLoadingPhone] = useState(false);

  const handleSimCheck = async () => {
    setIsLoadingSim(true);
    setError("");
    try {
      const mockData = getMockData(phoneNumber);
      if (!mockData) {
        throw new Error("Phone number not found in mock database");
      }

      const encryptedPhoneNumber = await encrypt(phoneNumber);
      const encryptedCustomerId = customerId ? await encrypt(customerId) : '';
      const encryptedSimData = await encrypt(JSON.stringify(mockData.simData));

      const response = await fetch("http://localhost:8000/api/v1/register/device-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: encryptedPhoneNumber,
          customerId: encryptedCustomerId,
          simData: encryptedSimData,
          checkType: "sim",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "SIM check failed");
      }

      if (data.status === "update_required") {
        setSimCheckStatus("update_required");
      } else if (data.status === "match") {
        setSimCheckStatus("success");
      } else {
        setSimCheckStatus("failed");
      }
    } catch (err: any) {
      setError(err.message || "Error performing SIM check");
      setSimCheckStatus("failed");
    } finally {
      setIsLoadingSim(false);
    }
  };

  const handlePhoneCheck = async () => {
    setIsLoadingPhone(true);
    setError("");
    try {
      const mockData = getMockData(phoneNumber);
      if (!mockData) {
        throw new Error("Phone number not found in mock database");
      }

      const encryptedPhoneNumber = await encrypt(phoneNumber);
      const encryptedCustomerId = customerId ? await encrypt(customerId) : '';
      const encryptedPhoneData = await encrypt(JSON.stringify(mockData.phoneData));

      const response = await fetch("http://localhost:8000/api/v1/register/device-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: encryptedPhoneNumber,
          customerId: encryptedCustomerId,
          phoneData: encryptedPhoneData,
          checkType: "phone",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Phone check failed");
      }

      if (data.status === "update_required") {
        setPhoneCheckStatus("update_required");
      } else if (data.status === "match") {
        setPhoneCheckStatus("success");
      } else {
        setPhoneCheckStatus("failed");
      }
    } catch (err: any) {
      setError(err.message || "Error performing phone check");
      setPhoneCheckStatus("failed");
    } finally {
      setIsLoadingPhone(false);
    }
  };

  const handleProceed = async () => {
    if (simCheckStatus === "success" && phoneCheckStatus === "success") {
      try {
        const encryptedPhoneNumber = await encrypt(phoneNumber);
        const response = await fetch("http://localhost:8000/api/v1/register/device-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encrypted_phone_number: encryptedPhoneNumber,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Device verification completion failed");
        }

        onProceed();
      } catch (err: any) {
        setError(err.message || "Error completing device verification");
      }
    } else {
      setError("Both SIM and Phone checks must be successful to proceed.");
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
            Device Verification
          </h1>
        </div>

        <div className="space-y-6">
          <div>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleSimCheck}
              disabled={isLoadingSim || simCheckStatus === "success"}
            >
              {isLoadingSim ? "Checking SIM..." : simCheckStatus === "success" ? "SIM Verified" : simCheckStatus === "update_required" ? "Update SIM Required" : "Run SIM Check"}
            </Button>
            {simCheckStatus === "update_required" && (
              <p className="text-sm text-red-600 mt-2">Please update your SIM details to proceed.</p>
            )}
            {simCheckStatus === "failed" && (
              <p className="text-sm text-red-600 mt-2">SIM check failed. Please try again.</p>
            )}
          </div>

          <div>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handlePhoneCheck}
              disabled={isLoadingPhone || phoneCheckStatus === "success"}
            >
              {isLoadingPhone ? "Checking Phone..." : phoneCheckStatus === "success" ? "Phone Verified" : phoneCheckStatus === "update_required" ? "Update Phone Required" : "Run Phone Check"}
            </Button>
            {phoneCheckStatus === "update_required" && (
              <p className="text-sm text-red-600 mt-2">Please update your phone details to proceed.</p>
            )}
            {phoneCheckStatus === "failed" && (
              <p className="text-sm text-red-600 mt-2">Phone check failed. Please try again.</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            variant="banking"
            size="xl"
            className="w-full"
            onClick={handleProceed}
            disabled={simCheckStatus !== "success" || phoneCheckStatus !== "success"}
          >
            Proceed
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DeviceVerification;