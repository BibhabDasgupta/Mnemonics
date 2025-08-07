import { useNavigate } from "react-router-dom";
import FidoSeedKeyRegistration from "@/components/FidoSeedKeyRegistration";
import { useAppContext } from "@/context/AppContext";

const FidoSeedKeyRegistrationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, customerName, setError } = useAppContext();

  const handleProceed = () => {
    setError("");
    navigate("/registration/signature", { replace: true });
  };

  return (
    <FidoSeedKeyRegistration
      phoneNumber={phoneNumber}
      customerId={customerId}
      customerName={customerName} // Fallback to "User" if empty
      onProceed={handleProceed}
    />
  );
};

export default FidoSeedKeyRegistrationPage;