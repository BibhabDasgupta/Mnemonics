import { useNavigate } from "react-router-dom";
import RegistrationDetails from "@/components/RegistrationDetails";
import { useAppContext } from "@/context/AppContext";

const RegistrationDetailsPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, setCustomerId, setError, setRegistrationCompleted } = useAppContext();

  const handleBack = () => {
    navigate("/registration/otp");
    setError("");
  };

  const handleProceed = (customerId: string) => {
    setCustomerId(customerId);
    setError("");
    navigate("/registration/device-verification", { replace: true });
  };

  return (
    <RegistrationDetails
      phoneNumber={phoneNumber}
      onBack={handleBack}
      onProceed={handleProceed}
    />
  );
};

export default RegistrationDetailsPage;