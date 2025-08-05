import { useNavigate } from "react-router-dom";
import FidoSeedKeyRegistration from "@/components/FidoSeedKeyRegistration";
import { useAppContext } from "@/context/AppContext";

const FidoSeedKeyRegistrationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError } = useAppContext();

  const handleProceed = () => {
    setError("");
    navigate("/registration/signature", { replace: true });
  };

  return (
    <FidoSeedKeyRegistration
      phoneNumber={phoneNumber}
      customerId={customerId}
      onProceed={handleProceed}
    />
  );
};

export default FidoSeedKeyRegistrationPage;