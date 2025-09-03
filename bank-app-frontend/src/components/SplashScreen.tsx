import { useEffect, useState } from "react";
import bankLogo from "@/assets/bank-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Allow fade out animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50 animate-fade-out">
        <div className="text-center">
          <img 
            src={bankLogo} 
            alt="DhanRakshak Logo" 
            className="w-32 h-32 mx-auto mb-4 opacity-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative">
          <img 
            src={bankLogo} 
            alt="DhanRakshak Logo" 
            className="w-32 h-32 mx-auto mb-4 animate-glow-pulse"
          />
          <div className="absolute inset-0 bg-gradient-glow rounded-full animate-glow-pulse opacity-50"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 opacity-80">
          DhanRakshak
        </h1>
      </div>
    </div>
  );
};

export default SplashScreen;