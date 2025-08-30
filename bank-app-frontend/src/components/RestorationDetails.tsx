import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar } from "lucide-react";
import { encrypt } from "@/utils/encryption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RestorationDetailsProps {
  onBack: () => void;
  onProceed: (name?: string) => void;
  phoneNumber: string;
  setError: (error: string) => void;
}

const RestorationDetails = ({ onBack, onProceed, phoneNumber, setError }: RestorationDetailsProps) => {
  const [formData, setFormData] = useState({
    customerId: "",
    name: "",
    email: "",
    aadhaarNumber: "",
    day: "",
    month: "",
    year: "",
  });
  const [error, setLocalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Generate calendar data
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    { value: "01", name: "January" },
    { value: "02", name: "February" },
    { value: "03", name: "March" },
    { value: "04", name: "April" },
    { value: "05", name: "May" },
    { value: "06", name: "June" },
    { value: "07", name: "July" },
    { value: "08", name: "August" },
    { value: "09", name: "September" },
    { value: "10", name: "October" },
    { value: "11", name: "November" },
    { value: "12", name: "December" },
  ];

  const getDaysInMonth = (month: string, year: string) => {
    if (!month || !year) return [];
    const daysCount = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => (i + 1).toString().padStart(2, '0'));
  };

  const handleDateSelect = (day: string, month: string, year: string) => {
    setFormData({ ...formData, day, month, year });
    setShowCalendar(false);
  };

  const formatDisplayDate = () => {
    if (formData.day && formData.month && formData.year) {
      return `${formData.day}/${formData.month}/${formData.year}`;
    }
    return "";
  };

  const getDateString = () => {
    if (formData.day && formData.month && formData.year) {
      return `${formData.year}-${formData.month}-${formData.day}`;
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError("");
    setError("");

    const dateString = getDateString();
    if (!dateString) {
      setError("Please select a valid date of birth");
      setIsLoading(false);
      return;
    }

    try {
      // Log form data before encryption
      console.log("Form data:", { ...formData, phoneNumber });

      const encryptedCustomerId = await encrypt(formData.customerId);
      const encryptedName = await encrypt(formData.name);
      const encryptedEmail = await encrypt(formData.email);
      const encryptedAadhaarNumber = await encrypt(formData.aadhaarNumber);
      const encryptedDateOfBirth = await encrypt(dateString);
      const encryptedPhoneNumber = await encrypt(phoneNumber);

      const payload = {
        encrypted_customer_id: encryptedCustomerId,
        encrypted_name: encryptedName,
        encrypted_email: encryptedEmail,
        encrypted_aadhaar_number: encryptedAadhaarNumber,
        encrypted_date_of_birth: encryptedDateOfBirth,
        encrypted_phone_number: encryptedPhoneNumber,
      };
      console.log("Sending payload:", payload);

      const response = await fetch("http://localhost:8000/api/v1/restore/complete", {
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

      localStorage.setItem("userName", formData.name);
      onProceed(formData.name);
    } catch (err: any) {
      const errorMessage = err.message || "Error verifying restoration details";
      setLocalError(errorMessage);
      setError(errorMessage);
      console.error("Restoration error:", err, "Message:", errorMessage);
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
            Account Restoration
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
          {/* Date of Birth Section */}
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>            
            <div className="mt-2">
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 justify-start text-left font-normal"
                    type="button"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatDisplayDate() || "Select from calendar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-4 space-y-4">
                    {/* Year and Month Selection */}
                    <div className="flex gap-2">
                      <select
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-md bg-background"
                      >
                        <option value="">Year</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                      <select
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-md bg-background"
                      >
                        <option value="">Month</option>
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Day Selection Grid */}
                    {formData.month && formData.year && (
                      <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(formData.month, formData.year).map((day) => (
                          <Button
                            key={day}
                            type="button"
                            variant={formData.day === day ? "default" : "ghost"}
                            className="h-8 w-8 p-0"
                            onClick={() => handleDateSelect(day, formData.month, formData.year)}
                          >
                            {day}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCalendar(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            variant="banking"
            size="xl"
            className="w-full"
            disabled={isLoading || !formData.customerId || !formData.name || !formData.email || !formData.aadhaarNumber || !formData.day || !formData.month || !formData.year}
          >
            {isLoading ? "Submitting..." : "Verify Details"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default RestorationDetails;