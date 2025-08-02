import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { encrypt } from "@/utils/encryption";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface RegistrationDetailsProps {
  onBack: () => void;
  onProceed: () => void;
  phoneNumber: string;
  customerId?: string;
}

const RegistrationDetails = ({ onBack, onProceed, phoneNumber }: RegistrationDetailsProps) => {
  const [formData, setFormData] = useState({
    customerId: "",
    name: "",
    email: "",
    aadhaarNumber: "",
    dateOfBirth: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      // Log form data before encryption
      console.log("Form data:", { ...formData, phoneNumber });

      const encryptedCustomerId = await encrypt(formData.customerId);
      const encryptedName = await encrypt(formData.name);
      const encryptedEmail = await encrypt(formData.email);
      const encryptedAadhaarNumber = await encrypt(formData.aadhaarNumber);
      const encryptedDateOfBirth = await encrypt(formData.dateOfBirth);
      const encryptedPhoneNumber = await encrypt(phoneNumber);

      const payload = {
        encrypted_customer_id: encryptedCustomerId,
        encrypted_name: encryptedName,
        encrypted_email: encryptedEmail,
        encrypted_aadhaar_number: encryptedAadhaarNumber,
        encrypted_date_of_birth: encryptedDateOfBirth,
        encrypted_phone_number: encryptedPhoneNumber,
        is_registered_in_app: false,
        last_sim_data: null,
        last_phone_data: null,
        other_details: [],
      };
      console.log("Sending payload:", payload);

      const response = await fetch("http://localhost:8000/api/v1/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: "Unknown error from server" };
        }
        console.error("Backend error response:", errorData);
        // Handle nested detail array
        let errorMessage = errorData.detail;
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => err.msg).join("; ");
        }
        throw new Error(errorMessage || `Request failed with status ${response.status}`);
      }

      onProceed();
    } catch (err: any) {
      const errorMessage = err.message || "Error registering details";
      setError(errorMessage);
      console.error("Registration error:", err, "Message:", errorMessage);
    } finally {
      setIsLoading(false);
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
            Registration Details
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customerId">Customer ID</Label>
            <Input
              id="customerId"
              name="customerId"
              type="text"
              placeholder="Enter your Customer ID"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
            <Input
              id="aadhaarNumber"
              name="aadhaarNumber"
              type="text"
              placeholder="Enter your Aadhaar number"
              value={formData.aadhaarNumber}
              onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <DatePicker
              selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
              onChange={(date: Date) =>
                setFormData({
                  ...formData,
                  dateOfBirth: date ? date.toISOString().split("T")[0] : "",
                })
              }
              dateFormat="yyyy-MM-dd"
              className="h-12 w-full border rounded-md p-2"
              placeholderText="Select date"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            variant="banking"
            size="xl"
            className="w-full"
            disabled={isLoading || !formData.customerId || !formData.name || !formData.email || !formData.aadhaarNumber || !formData.dateOfBirth}
          >
            {isLoading ? "Submitting..." : "Register"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default RegistrationDetails;