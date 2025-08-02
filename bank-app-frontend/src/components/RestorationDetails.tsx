import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface RestorationDetailsProps {
  onBack: () => void;
  onProceed: () => void;
  customerId?: string;
}

const RestorationDetails = ({ onBack, onProceed }: RestorationDetailsProps) => {
  const [formData, setFormData] = useState({
    customerId: "",
    aadhaarNo: "",
    dateOfBirth: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isFormValid = Object.values(formData).every(value => value.trim() !== "");
    if (isFormValid) {
      onProceed();
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
            Account Restoration
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerId">Customer ID</Label>
            <Input
              id="customerId"
              type="text"
              placeholder="Enter Customer ID"
              value={formData.customerId}
              onChange={(e) => handleInputChange("customerId", e.target.value)}
              className="h-12"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aadhaar">Aadhaar Number</Label>
            <Input
              id="aadhaar"
              type="text"
              placeholder="Enter Aadhaar Number"
              value={formData.aadhaarNo}
              onChange={(e) => handleInputChange("aadhaarNo", e.target.value)}
              className="h-12"
              maxLength={12}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
              className="h-12"
              required
            />
          </div>

          <Button 
            type="submit" 
            variant="banking" 
            size="xl" 
            className="w-full mt-6"
            disabled={!Object.values(formData).every(value => value.trim() !== "")}
          >
            Restore Account
          </Button>
        </form>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Your account will be restored after verification of the provided details
          </p>
        </div>
      </Card>
    </div>
  );
};

export default RestorationDetails;