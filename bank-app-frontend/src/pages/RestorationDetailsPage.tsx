import { useNavigate } from "react-router-dom";
import RestorationDetails from "@/components/RestorationDetails";
import { useAppContext } from "@/context/AppContext";

const RestorationDetailsPage = () => {
  const navigate = useNavigate();
  const { customerId, phoneNumber, setError, setCustomerName } = useAppContext();

  const handleBack = () => {
    navigate("/restoration/phone");
    setError("");
  };

  const handleProceed = (name?: string) => {
    if (name) {
      setCustomerName(name); // Update context with name
    }
    navigate("/restoration/fido-seedkey");
    setError("");
  };

  return (
    <RestorationDetails
      onBack={handleBack}
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      setError={setError}
    />
  );
};

export default RestorationDetailsPage;