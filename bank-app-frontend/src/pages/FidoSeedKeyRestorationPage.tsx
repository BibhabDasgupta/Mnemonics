// import { useNavigate } from 'react-router-dom';
// import FidoSeedKeyRestoration from '@/components/FidoSeedKeyRestoration';
// import { useAppContext } from '@/context/AppContext';

// const FidoSeedKeyRestorationPage = () => {
//   const navigate = useNavigate();
//   const { customerId, phoneNumber, customerName, setError } = useAppContext();

//   const handleProceed = () => {
//     navigate('/restoration/device-check');
//     setError('');
//   };

//   return (
//     <FidoSeedKeyRestoration
//       onProceed={handleProceed}
//       phoneNumber={phoneNumber}
//       customerId={customerId}
//       customerName={customerName}
//     />
//   );
// };

// export default FidoSeedKeyRestorationPage;


import { useNavigate } from 'react-router-dom';
import FidoSeedKeyRestoration from '@/components/FidoSeedKeyRestoration';
import { useAppContext } from '@/context/AppContext';
import { encrypt } from '@/utils/encryption';

const FidoSeedKeyRestorationPage = () => {
  const navigate = useNavigate();
  const { customerId, phoneNumber, customerName, setError } = useAppContext();

  const handleProceed = async () => {
    try {
      const encryptedPhoneNumber = await encrypt(phoneNumber);
      const encryptedCustomerId = customerId ? await encrypt(customerId) : '';

      const response = await fetch('http://localhost:8000/api/v1/restore/check-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: encryptedPhoneNumber,
          customerId: encryptedCustomerId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to check signature status.');
      }

      const { signature_exists } = await response.json();
      if (signature_exists) {
        navigate('/restoration/signature');
      } else {
        navigate('/registration/signature');
      }
      setError('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  return (
    <FidoSeedKeyRestoration
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      customerId={customerId}
      customerName={customerName}
    />
  );
};

export default FidoSeedKeyRestorationPage;