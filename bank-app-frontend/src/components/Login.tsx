import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import bankLogo from "@/assets/bank-logo.png";
import { useState } from "react";

interface LoginProps {
  onBack: () => void;
  onProceed: () => void;
}

const Login = ({ onBack, onProceed }: LoginProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    // Add your login logic here (e.g., API call)
    if (phoneNumber && password) {
      onProceed();
    }
  };

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
            Login to GlowBank
          </h1>
          <p className="text-muted-foreground">
            Access your account securely
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              size="xl" 
              className="w-full"
              onClick={onBack}
            >
              Back
            </Button>
            <Button 
              variant="banking" 
              size="xl" 
              className="w-full"
              onClick={handleSubmit}
            >
              Login
            </Button>
          </div>
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

export default Login;