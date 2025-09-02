// import { useNavigate } from "react-router-dom";
// import SignatureRegistration from "@/components/SignatureRegistration";
// import { useAppContext } from "@/context/AppContext";

// const SignatureRegistrationPage = () => {
//   const navigate = useNavigate();
//   const { phoneNumber, customerId, setError, setRegistrationCompleted } = useAppContext();

//   const handleProceed = () => {
//     setRegistrationCompleted(true);
//     setError("");
//     navigate("/login", { replace: true });
//   };

//   return (
//     <SignatureRegistration
//       onProceed={handleProceed}
//       phoneNumber={phoneNumber}
//       customerId={customerId}
//     />
//   );
// };

// export default SignatureRegistrationPage;




// --- File: src/pages/SignatureRegistrationPage.tsx ---
import { useNavigate } from "react-router-dom";
import SignatureRegistration from "@/components/SignatureRegistration";
import { useAppContext } from "@/context/AppContext";

const SignatureRegistrationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError, setRegistrationCompleted } = useAppContext();

  const handleProceed = () => {
    // Only call setRegistrationCompleted if it exists
    setRegistrationCompleted?.(true);
    setError('');
    navigate("/login", { replace: true });
  };

  // Don't render if required data is missing
  if (!phoneNumber) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Missing phone number</p>
          <button 
            onClick={() => navigate('/')} 
            className="text-blue-600 underline"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <SignatureRegistration
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      customerId={customerId}
    />
  );
};

export default SignatureRegistrationPage;