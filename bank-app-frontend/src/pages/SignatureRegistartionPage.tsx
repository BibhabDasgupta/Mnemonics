import { useNavigate } from "react-router-dom";
import SignatureRegistration from "@/components/SignatureRegistration";
import { useAppContext } from "@/context/AppContext";

const SignatureRegistrationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError, setRegistrationCompleted } = useAppContext();

  const handleProceed = () => {
    setRegistrationCompleted(true);
    setError("");
    navigate("/login", { replace: true });
  };

  return (
    <SignatureRegistration
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      customerId={customerId}
    />
  );
};

export default SignatureRegistrationPage;