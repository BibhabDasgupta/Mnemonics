import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import bankLogo from "@/assets/bank-logo.png";

interface LandingPageProps {
  onNavigation: (page: 'registration' | 'login' | 'restoration') => void;
}

const LandingPage = ({ onNavigation }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="text-center mb-8">
          <img 
            src={bankLogo} 
            alt="GlowBank Logo" 
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to GlowBank
          </h1>
          <p className="text-muted-foreground">
            Your trusted digital banking partner
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            variant="landing" 
            size="xl" 
            className="w-full"
            onClick={() => onNavigation('registration')}
          >
            New Registration
          </Button>
          
          <Button 
            variant="outline" 
            size="xl" 
            className="w-full"
            onClick={() => onNavigation('restoration')}
          >
            Account Restoration
          </Button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Secure • Reliable • Trusted
          </p>
        </div>
      </Card>
    </div>
  );
};

export default LandingPage;