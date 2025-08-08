import { useNavigate } from 'react-router-dom';
import SignatureVerification from '@/components/SignatureVerification';
import { useAppContext } from '@/context/AppContext';

const SignatureVerificationPage = () => {
  const navigate = useNavigate();
  const { phoneNumber, customerId, setError } = useAppContext();

  const handleProceed = () => {
    setError('');
    navigate('/login', { replace: true });
  };

  return (
    <SignatureVerification
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      customerId={customerId}
    />
  );
};

export default SignatureVerificationPage;