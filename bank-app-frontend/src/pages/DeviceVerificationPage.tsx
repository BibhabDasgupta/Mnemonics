import { useNavigate } from "react-router-dom";
import DeviceVerification from "@/components/DeviceVerification";
import { useAppContext } from "@/context/appContext";

const DeviceVerificationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError } = useAppContext();

  const handleProceed = () => {
    setError("");
    navigate("/registration/fido-seedkey", { replace: true });
  };

  return (
    <DeviceVerification
      phoneNumber={phoneNumber}
      customerId={customerId}
      onProceed={handleProceed}
    />
  );
};

export default DeviceVerificationPage;