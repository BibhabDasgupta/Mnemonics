// pages/PhoneNumberPage.tsx
import { useNavigate } from "react-router-dom";
import PhoneNumberStep from "@/components/PhoneNumberStep";
import { useAppContext } from "@/context/AppContext";

interface PhoneNumberPageProps {
  title: string;
  isOTP: boolean;
}

const PhoneNumberPage = ({ title, isOTP }: PhoneNumberPageProps) => {
  const navigate = useNavigate();
  const { phoneNumber, setPhoneNumber, customerId, setCustomerId, error, setError } = useAppContext();

  const handleBack = () => {
    navigate("/landing");
    setError("");
  };

  const handlePhoneSubmit = (phone: string, status?: string, customerId?: string) => {
    setPhoneNumber(phone);
    setCustomerId(customerId);

    if (title === "Registration") {
      if (status === "revoked") {
        navigate("/revoked");
      } else if (status === "registered" || status === "preregistered") {
        navigate("/already-registered");
      } else {
        navigate("/registration/otp"); // Skipping OTP as per original logic
      }
    } else if (title === "Account Restoration") {
      if (status === "revoked") {
        navigate("/revoked");
      } else if (status === "new") {
        navigate("/landing");
        setError("Phone number not registered. Please register first.");
      } else {
        navigate("/restoration/details");
      }
    }
    setError("");
  };

  const handleOTPSubmit = (phone: string, status: string, customerId?: string) => {
    setPhoneNumber(phone);
    if (customerId) setCustomerId(customerId);
    setError("");

    if (status === "revoked") {
      navigate("/revoked");
    } else if (status === "registered" || status === "preregistered") {
      navigate("/already-registered");
    } else if (status === "verified") {
      navigate("/registration/details");
    }
  };

  return (
    <PhoneNumberStep
      title={title}
      onBack={handleBack}
      onProceed={isOTP ? handleOTPSubmit : handlePhoneSubmit}
      phoneNumber={phoneNumber}
      error={error}
      setError={setError}
      isOTP={isOTP}
    />
  );
};

export default PhoneNumberPage;