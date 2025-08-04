import { useNavigate } from "react-router-dom";
import Login from "@/components/Login";

const LoginPage = () => {
  const navigate = useNavigate();

  const handleProceed = () => {
    navigate("/dashboard", { replace: true });
  };

  return <Login onProceed={handleProceed} />;
};

export default LoginPage;