// import { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, loadCustomerInfo } from '@/utils/deviceStateChecker';
// import { arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex, base64ToArrayBuffer, arrayBufferToBase64, hexToArrayBuffer } from '@/utils/crypto';
// import { useNavigate } from 'react-router-dom';

// interface FidoLoginProps {
//   onSuccess: () => void;
//   customerName: string | null;
// }

// const FidoLogin = ({ onSuccess, customerName }: FidoLoginProps) => {
//   const [error, setError] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const navigate = useNavigate();

//   const handleFidoLogin = async () => {
//     if (!window.PublicKeyCredential) {
//       setError('WebAuthn is not supported in this browser.');
//       return;
//     }

//     const available = await checkWindowsHelloAvailability();
//     if (!available) {
//       setError('Windows Hello is not available on this device.');
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const customerInfo = await loadCustomerInfo();
//       if (!customerInfo || !customerInfo.customerId) {
//         throw new Error('Customer information not found in IndexedDB.');
//       }
//       const customerId = customerInfo.customerId;

//       // Check device state
//       const currentState = await checkDeviceState();
//       if (!currentState) {
//         setError('Failed to check device state.');
//         navigate("/landing", { replace: true });
//         return;
//       }

//       const storedState = await loadDeviceState(customerId);
//       if (!storedState || storedState.biometric_hash !== currentState.current_hash) {
//         setError('Device biometric state has changed.');
//         navigate("/landing", { replace: true });
//         return;
//       }

//       // Start FIDO2 authentication
//       const response = await fetch('http://localhost:8000/api/v1/login/fido-start', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ customer_id: customerId }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to start FIDO2 login.');
//       }

//       const { challenge, timeout, rpId, allowCredentials, userVerification } = await response.json();

//       // const authOptions = {
//       //   challenge: base64urlToArrayBuffer(challenge),
//       //   timeout,
//       //   rpId,
//       //   allowCredentials: allowCredentials.map((cred: any) => ({
//       //     ...cred,
//       //     id: base64urlToArrayBuffer(cred.id),
//       //   })),
//       //   userVerification,
//       // };

//       const authOptions = {
//         challenge: base64urlToArrayBuffer(challenge),
//         timeout,
//         rpId,
//         allowCredentials: allowCredentials.map((cred: any) => ({
//           ...cred,
//           id: base64urlToArrayBuffer(cred.id),
//         })),
//         userVerification,
//         authenticatorSelection: {
//           authenticatorAttachment: 'platform', // Force Windows Hello
//           userVerification: 'required',
//         },
//       };

//       const credential = await navigator.credentials.get({ publicKey: authOptions }) as PublicKeyCredential;
//       if (!credential) {
//         throw new Error('Failed to retrieve credential.');
//       }

//       const responseData = credential.response as AuthenticatorAssertionResponse;
//       const authData = {
//         id: credential.id,
//         rawId: arrayBufferToBase64url(credential.rawId),
//         type: credential.type,
//         response: {
//           clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
//           authenticatorData: arrayBufferToBase64url(responseData.authenticatorData),
//           signature: arrayBufferToBase64url(responseData.signature),
//           userHandle: responseData.userHandle ? arrayBufferToBase64url(responseData.userHandle) : null,
//         },
//       };

//       // Finish FIDO2 authentication
//       const loginResponse = await fetch('http://localhost:8000/api/v1/login/fido-finish', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           customer_id: customerId,
//           credential: authData,
//         }),
//       });

//       if (!loginResponse.ok) {
//         const data = await loginResponse.json();
//         throw new Error(data.detail || 'FIDO2 login failed.');
//       }

//       const { status, symmetric_key, seed_challenge, customer_id } = await loginResponse.json();
//       if (status !== 'fido_verified') {
//         throw new Error('FIDO2 verification failed.');
//       }

//       // Decrypt seed private key and sign seed challenge
//       const storedKey = await loadCustomerInfo();
//       if (!storedKey || !storedKey.encryptedPrivateKey) {
//         throw new Error('Encrypted private key not found in IndexedDB.');
//       }

//       const { iv, encryptedData } = storedKey.encryptedPrivateKey;
//       const symmetricKey = await crypto.subtle.importKey(
//         'raw',
//         base64urlToArrayBuffer(symmetric_key),
//         { name: 'AES-GCM', length: 256 },
//         true,
//         ['decrypt']
//       );

//       const decryptedPrivateKey = await crypto.subtle.decrypt(
//         { name: 'AES-GCM', iv: new Uint8Array(iv) },
//         symmetricKey,
//         new Uint8Array(encryptedData)
//       );

//       // Convert decrypted private key to hex string
//       const privateKeyHex = arrayBufferToHex(decryptedPrivateKey);
//       const challengeBytes = new TextEncoder().encode(seed_challenge);
//       const privateKey = await crypto.subtle.importKey(
//         'raw',
//         hexToArrayBuffer(privateKeyHex),
//         { name: 'ECDSA', namedCurve: 'P-256' },
//         false,
//         ['sign']
//       );

//       const signature = arrayBufferToBase64(
//         await crypto.subtle.sign(
//           { name: 'ECDSA', hash: { name: 'SHA-256' } },
//           privateKey,
//           challengeBytes
//         )
//       );

//       // Verify seed key signature
//       const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           customer_id: customer_id,
//           challenge: seed_challenge,
//           signature,
//         }),
//       });

//       if (!verifyResponse.ok) {
//         const data = await verifyResponse.json();
//         throw new Error(data.detail || 'Seed key verification failed.');
//       }

//       const { token } = await verifyResponse.json();

//       // Set JWT in cookie
//       document.cookie = `auth_token=${token}; max-age=600; path=/; Secure; HttpOnly; SameSite=Strict`;

//       onSuccess();
//     } catch (err) {
//       setError(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
//       <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
//         <div className="text-center mb-8">
//           <h1 className="text-3xl font-bold text-foreground mb-2">
//             Welcome {customerName || 'User'}, Login to GlowBank
//           </h1>
//           <p className="text-muted-foreground">
//             Authenticate using your biometric (fingerprint, face, or PIN).
//           </p>
//         </div>
//         <Button
//           variant="banking"
//           size="xl"
//           className="w-full"
//           onClick={handleFidoLogin}
//           disabled={isLoading}
//         >
//           {isLoading ? 'Authenticating...' : 'Start FIDO2 Verification'}
//         </Button>
//         {error && <p className="text-red-500 mt-4">{error}</p>}
//         <div className="mt-8 text-center">
//           <p className="text-xs text-muted-foreground">
//             Secure • Reliable • Trusted
//           </p>
//         </div>
//       </Card>
//     </div>
//   );
// };

// export default FidoLogin;


import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, loadCustomerInfo } from '@/utils/deviceStateChecker';
import { arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex, base64ToArrayBuffer, arrayBufferToBase64, hexToArrayBuffer } from '@/utils/crypto';
import { useNavigate } from 'react-router-dom';

interface FidoLoginProps {
  onSuccess: () => void;
  customerName: string | null;
}

const FidoLogin = ({ onSuccess, customerName }: FidoLoginProps) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleFidoLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('WebAuthn is not supported in this browser.');
      return;
    }

    const available = await checkWindowsHelloAvailability();
    if (!available) {
      setError('Windows Hello is not available on this device.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const customerInfo = await loadCustomerInfo();
      if (!customerInfo || !customerInfo.customerId) {
        throw new Error('Customer information not found in IndexedDB.');
      }
      const customerId = customerInfo.customerId;

      // Check device state
      const currentState = await checkDeviceState();
      if (!currentState) {
        setError('Failed to check device state.');
        navigate("/landing", { replace: true });
        return;
      }

      const storedState = await loadDeviceState(customerId);
      if (!storedState || storedState.biometric_hash !== currentState.current_hash) {
        setError('Device biometric state has changed.');
        navigate("/landing", { replace: true });
        return;
      }

      // Start FIDO2 authentication
      const response = await fetch('http://localhost:8000/api/v1/login/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to start FIDO2 login.');
      }

      const { challenge, timeout, rpId, allowCredentials, userVerification } = await response.json();

      // // ✅ Fixed: Removed authenticatorSelection from authentication options
      // // Only filter allowCredentials to include platform authenticators if needed
      // const platformCredentials = allowCredentials.filter((cred: any) => {
      //   // If you stored transport info during registration, you could filter here
      //   // For now, we'll include all credentials but rely on userVerification
      //   return true;
      // });

      // const authOptions = {
      //   challenge: base64urlToArrayBuffer(challenge),
      //   timeout,
      //   rpId,
      //   allowCredentials: platformCredentials.map((cred: any) => ({
      //     ...cred,
      //     id: base64urlToArrayBuffer(cred.id),
      //     // Optional: Add transports if you have them stored
      //     transports: ['internal'] // This helps hint at platform authenticators
      //   })),
      //   userVerification: 'required', // ✅ Force user verification to prefer Windows Hello
      // };

      const authOptions = {
        challenge: base64urlToArrayBuffer(challenge),
        timeout,
        rpId,
        allowCredentials: allowCredentials.map((cred: any) => ({
          ...cred,
           id: base64urlToArrayBuffer(cred.id),
        })),
        userVerification,
      };

      const credential = await navigator.credentials.get({ publicKey: authOptions }) as PublicKeyCredential;
      if (!credential) {
        throw new Error('Failed to retrieve credential.');
      }

      const responseData = credential.response as AuthenticatorAssertionResponse;
      const authData = {
        id: credential.id,
        rawId: arrayBufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
          authenticatorData: arrayBufferToBase64url(responseData.authenticatorData),
          signature: arrayBufferToBase64url(responseData.signature),
          userHandle: responseData.userHandle ? arrayBufferToBase64url(responseData.userHandle) : null,
        },
      };

      // Finish FIDO2 authentication
      const loginResponse = await fetch('http://localhost:8000/api/v1/login/fido-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          credential: authData,
        }),
      });

      if (!loginResponse.ok) {
        const data = await loginResponse.json();
        throw new Error(data.detail || 'FIDO2 login failed.');
      }

      const { status, symmetric_key, seed_challenge, customer_id } = await loginResponse.json();
      if (status !== 'fido_verified') {
        throw new Error('FIDO2 verification failed.');
      }

      // Decrypt seed private key and sign seed challenge
      const storedKey = await loadCustomerInfo();
      if (!storedKey || !storedKey.encryptedPrivateKey) {
        throw new Error('Encrypted private key not found in IndexedDB.');
      }

      const { iv, encryptedData } = storedKey.encryptedPrivateKey;
      const symmetricKey = await crypto.subtle.importKey(
        'raw',
        base64urlToArrayBuffer(symmetric_key),
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt']
      );

      const decryptedPrivateKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        symmetricKey,
        new Uint8Array(encryptedData)
      );

      // Convert decrypted private key to hex string
      const privateKeyHex = arrayBufferToHex(decryptedPrivateKey);
      const challengeBytes = new TextEncoder().encode(seed_challenge);
      const privateKey = await crypto.subtle.importKey(
        'raw',
        hexToArrayBuffer(privateKeyHex),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );

      const signature = arrayBufferToBase64(
        await crypto.subtle.sign(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          privateKey,
          challengeBytes
        )
      );

      // Verify seed key signature
      const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer_id,
          challenge: seed_challenge,
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.detail || 'Seed key verification failed.');
      }

      const { token } = await verifyResponse.json();

      // Set JWT in cookie
      document.cookie = `auth_token=${token}; max-age=600; path=/; Secure; HttpOnly; SameSite=Strict`;

      onSuccess();
    } catch (err) {
      setError(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome {customerName || 'User'}, Login to GlowBank
          </h1>
          <p className="text-muted-foreground">
            Authenticate using your biometric (fingerprint, face, or PIN).
          </p>
        </div>
        <Button
          variant="banking"
          size="xl"
          className="w-full"
          onClick={handleFidoLogin}
          disabled={isLoading}
        >
          {isLoading ? 'Authenticating...' : 'Start FIDO2 Verification'}
        </Button>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Secure • Reliable • Trusted
          </p>
        </div>
      </Card>
    </div>
  );
};

export default FidoLogin;