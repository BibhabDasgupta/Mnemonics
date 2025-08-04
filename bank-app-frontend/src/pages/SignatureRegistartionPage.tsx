import { useNavigate } from "react-router-dom";
import SignatureRegistration from "@/components/SignatureRegistration";
import { useAppContext } from "@/context/appContext";

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