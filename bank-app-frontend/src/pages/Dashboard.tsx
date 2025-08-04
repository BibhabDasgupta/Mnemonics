// pages/DashboardPage.tsx
import { useNavigate } from "react-router-dom";
import Dashboard from "@/components/Dashboard";
import { useAppContext } from "@/context/appContext";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { setPhoneNumber, setCustomerId, setError } = useAppContext();

  const handleLogout = () => {
    setPhoneNumber("");
    setCustomerId(undefined);
    setError("");
    navigate("/login");
  };

  return <Dashboard onLogout={handleLogout} />;
};

export default DashboardPage;