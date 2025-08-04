// pages/SplashScreenPage.tsx
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";

const SplashScreenPage = () => {
  const navigate = useNavigate();

  const handleSplashComplete = () => {
    navigate("/landing");
  };

  return <SplashScreen onComplete={handleSplashComplete} />;
};

export default SplashScreenPage;