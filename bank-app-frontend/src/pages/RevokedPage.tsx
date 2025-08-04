// pages/RevokedPage.tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const RevokedPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/landing");
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Access Revoked</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          App access is revoked. Please visit a branch for re-registration.
        </p>
        <Button variant="banking" size="xl" className="w-full" onClick={handleBack}>
          Back to Landing
        </Button>
      </Card>
    </div>
  );
};

export default RevokedPage;