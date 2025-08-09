import { useNavigate } from "react-router-dom";
import RestorationPhoneStep from "@/components/RestorationPhoneStep";
import { useAppContext } from "@/context/AppContext";

interface RestorationPhonePageProps {
  title: string;
}

const RestorationPhonePage = ({ title }: RestorationPhonePageProps) => {
  const navigate = useNavigate();
  const { phoneNumber, setPhoneNumber, customerId, setCustomerId, error, setError } = useAppContext();

  const handleBack = () => {
    navigate("/landing");
    setError("");
  };

  const handlePhoneSubmit = (phone: string, status?: string, customerId?: string) => {
    setPhoneNumber(phone);
    setCustomerId(customerId);

    if (status === "revoked") {
      navigate("/revoked");
    } else if (status === "new" || status === "fresh") {
      setError("Phone number not registered. Please register first.");
      // Do not navigate; let RestorationPhoneStep handle error display and button
    } else if (status === "registered") {
      navigate("/restoration/details");
    }
  };

  return (
    <RestorationPhoneStep
      title={title}
      onBack={handleBack}
      onProceed={handlePhoneSubmit}
      phoneNumber={phoneNumber}
      error={error}
      setError={setError}
    />
  );
};

export default RestorationPhonePage;