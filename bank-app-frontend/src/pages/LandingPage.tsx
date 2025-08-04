// pages/LandingPage.tsx
import { useNavigate } from "react-router-dom";
import LandingPageComponent from "@/components/LandingPage";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleNavigation = (page: "registration" | "login" | "restoration") => {
    if (page === "registration") {
      navigate("/registration/phone");
    } else if (page === "login") {
      navigate("/login");
    } else if (page === "restoration") {
      navigate("/restoration/phone");
    }
  };

  return <LandingPageComponent onNavigation={handleNavigation} />;
};

export default LandingPage;