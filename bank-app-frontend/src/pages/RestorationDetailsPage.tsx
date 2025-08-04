// pages/RestorationDetailsPage.tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useAppContext } from "@/context/appContext";

const RestorationDetailsPage = () => {
  const navigate = useNavigate();
  const { customerId, setError } = useAppContext();

  const handleBack = () => {
    navigate("/restoration/phone");
    setError("");
  };

  const handleProceed = () => {
    navigate("/login");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Account Restoration</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Placeholder for Restoration Details page. Implement restoration functionality here. Customer ID: {customerId || "N/A"}.
        </p>
        <Button variant="banking" size="xl" className="w-full" onClick={handleProceed}>
          Proceed to Login (Placeholder)
        </Button>
        <Button variant="outline" size="xl" className="w-full mt-4" onClick={handleBack}>
          Back
        </Button>
      </Card>
    </div>
  );
};

export default RestorationDetailsPage;