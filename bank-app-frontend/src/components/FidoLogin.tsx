import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, loadCustomerInfo, initIndexedDB } from '@/utils/deviceStateChecker';
import { arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex, hexToArrayBuffer } from '@/utils/crypto';
import { useNavigate } from 'react-router-dom';
import { getPublicKey } from '@noble/secp256k1';

interface FidoLoginProps {
  onSuccess: () => void;
  customerName: string | null;
}

const FidoLogin = ({ onSuccess, customerName }: FidoLoginProps) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricMismatchPopup, setShowBiometricMismatchPopup] = useState(false);
  const navigate = useNavigate();

  const showBiometricMismatchError = async () => {
    setShowBiometricMismatchPopup(true);
     try {
      // Clear IndexedDB
      const db = await initIndexedDB();
      const transaction = db.transaction(['EncryptedKeys', 'DeviceStates', 'CustomerInfo'], 'readwrite');
      const keyStore = transaction.objectStore('EncryptedKeys');
      const deviceStore = transaction.objectStore('DeviceStates');
      const customerStore = transaction.objectStore('CustomerInfo');
      keyStore.clear();
      deviceStore.clear();
      customerStore.clear();
      await new Promise((resolve) => {
        transaction.oncomplete = () => resolve(null);
      });

      localStorage.clear();

    setTimeout(() => {
      setShowBiometricMismatchPopup(false);
      navigate("/landing", { replace: true });
    }, 9000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    } finally {
      setIsLoading(false);
    }
  };

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

      const currentState = await checkDeviceState();
      if (!currentState) {
        setError('Failed to check device state.');
        navigate("/landing", { replace: true });
        return;
      }

      const storedState = await loadDeviceState(customerId);
      if (!storedState || storedState.biometric_hash !== currentState.current_hash) {
        setIsLoading(false);
        showBiometricMismatchError();
        return;
      }

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

      const authOptions = {
        challenge: base64urlToArrayBuffer(challenge),
        timeout,
        rpId,
        allowCredentials: allowCredentials.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id),
          transports: cred.transports || ['internal'],
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

      // console.log('Auth Data Sent:', JSON.stringify(authData, null, 2));

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

      // console.log('Symmetric Key Base64:', symmetric_key);
      const symmetricKeyBytes = base64urlToArrayBuffer(symmetric_key);
      // console.log('Symmetric Key Bytes:', Array.from(new Uint8Array(symmetricKeyBytes)), 'Length:', symmetricKeyBytes.byteLength, 'Hex:', arrayBufferToHex(symmetricKeyBytes));
      if (symmetricKeyBytes.byteLength !== 32) {
        throw new Error(`Invalid symmetric key length: ${symmetricKeyBytes.byteLength} bytes`);
      }

      let symmetricKey;
      try {
        symmetricKey = await crypto.subtle.importKey(
          'raw',
          symmetricKeyBytes,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
        // console.log('Symmetric Key Imported Successfully');
      } catch (err) {
        console.error('Symmetric Key Import Error:', err);
        throw new Error(`Failed to import symmetric key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      const storedKey = await loadCustomerInfo();
      // console.log('Stored Key:', JSON.stringify(storedKey, null, 2));
      if (!storedKey || !storedKey.encryptedPrivateKey) {
        throw new Error('Encrypted private key not found in IndexedDB.');
      }

      const { iv, encryptedData } = storedKey.encryptedPrivateKey;
      // console.log('IV:', iv, 'IV Length:', iv.length);
      // console.log('Encrypted Data Length:', encryptedData.length);
      if (encryptedData.length !== 48) {
        console.warn(`Warning: Encrypted private key length is ${encryptedData.length} bytes, expected 48 bytes. Attempting to handle legacy data.`);
      }

      let decryptedPrivateKey;
      try {
        decryptedPrivateKey = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          symmetricKey,
          new Uint8Array(encryptedData)
        );
        // console.log('Private Key Decrypted Successfully');
      } catch (err) {
        console.error('Decryption Error:', err);
        throw new Error(`Failed to decrypt private key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      let privateKeyBytes = decryptedPrivateKey;
      // console.log('Decrypted Private Key Hex:', arrayBufferToHex(decryptedPrivateKey), 'Length:', decryptedPrivateKey.byteLength);
      if (decryptedPrivateKey.byteLength === 64) {
        console.warn('Warning: Decrypted key is 64 bytes, likely a hex string. Converting to raw bytes.');
        try {
          const hexString = new TextDecoder().decode(decryptedPrivateKey);
          if (!/^[0-9a-fA-F]{64}$/.test(hexString)) {
            throw new Error('Decrypted data is not a valid 64-character hex string.');
          }
          privateKeyBytes = hexToArrayBuffer(hexString);
          // console.log('Converted Private Key Bytes:', Array.from(new Uint8Array(privateKeyBytes)), 'Length:', privateKeyBytes.byteLength);
        } catch (err) {
          console.error('Hex Conversion Error:', err);
          throw new Error(`Failed to convert decrypted hex string to bytes: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      if (privateKeyBytes.byteLength !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyBytes.byteLength} bytes, expected 32`);
      }

      let publicKeyHex;
      try {
        // Derive public key (compressed, 33 bytes)
        const publicKey = getPublicKey(new Uint8Array(privateKeyBytes), true);
        publicKeyHex = arrayBufferToHex(publicKey);
        // console.log('Derived Public Key Hex:', publicKeyHex, 'Length:', publicKey.length);
      } catch (err) {
        console.error('Public Key Error:', err);
        throw new Error(`Failed to derive public key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      // Log the request payload for debugging
      const verifyPayload = {
        customer_id: customer_id,
        challenge: seed_challenge,
        public_key: publicKeyHex,
      };
      // console.log('Seedkey verification payload:', JSON.stringify(verifyPayload, null, 2));

      const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });

      if (!verifyResponse.ok) {
        // Better error handling for HTTP errors
        let errorMessage = 'Seed key verification failed.';
        try {
          const errorData = await verifyResponse.json();
          console.error('Seedkey verification error response:', errorData);
          
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              // Handle FastAPI validation errors
              const validationErrors = errorData.detail.map((err: any) => 
                `${err.loc?.join?.('.') || 'field'}: ${err.msg || 'validation error'}`
              ).join(', ');
              errorMessage = `Validation errors: ${validationErrors}`;
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${verifyResponse.status}: ${verifyResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const { token } = await verifyResponse.json();
      document.cookie = `auth_token=${token}; max-age=600; path=/; Secure; SameSite=Strict`;

      onSuccess();
    } catch (err) {
      console.error('FIDO2 login error:', err);
      
      // Better error message handling
      let errorMessage = 'Unknown error';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        // Try to extract meaningful information from the error object
        if ('message' in err) {
          errorMessage = String(err.message);
        } else if ('detail' in err) {
          errorMessage = String(err.detail);
        } else {
          errorMessage = JSON.stringify(err);
        }
      }
      
      setError(`Login failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome {customerName || 'User'}, Login to Bank App
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

      {/* Biometric Mismatch Popup */}
      {showBiometricMismatchPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-red-500 text-white p-8 rounded-lg shadow-lg max-w-md mx-4 text-center animate-pulse">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Biometric Mismatch</h2>
            <p className="text-lg mb-4">
              Your device biometric state has changed. You will be redirected to the landing page.
            </p>
            <p className="text-sm opacity-90">
              Please restore your device to continue using the application.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FidoLogin;