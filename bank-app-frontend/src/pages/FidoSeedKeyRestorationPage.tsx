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


// import { useNavigate } from 'react-router-dom';
// import FidoSeedKeyRestoration from '@/components/FidoSeedKeyRestoration';
// import { useAppContext } from '@/context/AppContext';
// import { encrypt } from '@/utils/encryption';

// const FidoSeedKeyRestorationPage = () => {
//   const navigate = useNavigate();
//   const { customerId, phoneNumber, customerName, setError } = useAppContext();

//   const handleProceed = async () => {
//     try {
//       const encryptedPhoneNumber = await encrypt(phoneNumber);
//       const encryptedCustomerId = customerId ? await encrypt(customerId) : '';

//       const response = await fetch('http://localhost:8000/api/v1/restore/check-signature', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           phoneNumber: encryptedPhoneNumber,
//           customerId: encryptedCustomerId,
//         }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to check signature status.');
//       }

//       const { signature_exists } = await response.json();
//       if (signature_exists) {
//         navigate('/restoration/signature');
//       } else {
//         navigate('/registration/signature');
//       }
//       setError('');
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Unknown error';
//       setError(errorMessage);
//     }
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



// --- File: src/pages/FidoSeedKeyRestorationPage.tsx ---
import { useNavigate } from 'react-router-dom';
import FidoSeedKeyRestoration from '@/components/FidoSeedKeyRestoration';
import { useAppContext } from '@/context/AppContext';
import { encrypt } from '@/utils/encryption';

const FidoSeedKeyRestorationPage = () => {
  const navigate = useNavigate();
  const { customerId, phoneNumber, customerName, setError } = useAppContext();

  const handleProceed = async () => {
    try {
      // Ensure we have required data
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

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
        // Clean navigation - no attempt counter or lockout data needed
        navigate('/restoration/signature');
      } else {
        navigate('/registration/signature');
      }
      setError('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Restoration error:', err);
    }
  };

  // Don't render if required data is missing
  if (!phoneNumber || !customerId) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Missing required information</p>
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
    <FidoSeedKeyRestoration
      onProceed={handleProceed}
      phoneNumber={phoneNumber}
      customerId={customerId}
      customerName={customerName || ''}
    />
  );
};

export default FidoSeedKeyRestorationPage;