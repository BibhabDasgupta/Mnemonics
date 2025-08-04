import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { encrypt } from '@/utils/encryption';
import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, storeKeyInIndexedDB , saveDeviceState} from '@/utils/deviceStateChecker';
import { deriveKeys } from '@/utils/crypto';
import { Buffer } from 'buffer';

interface FidoLoginProps {
  onBack: () => void;
  onSuccess: () => void;
  customerId: string;
}

const FidoLogin = ({ onBack, onSuccess, customerId }: FidoLoginProps) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState('');
  const [showSeedInput, setShowSeedInput] = useState(false);

  const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const base64urlToArrayBuffer = (base64url: string): ArrayBuffer => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
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
      const encryptedCustomerId = await encrypt(customerId);
      const response = await fetch('http://localhost:8000/api/v1/login/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: encryptedCustomerId }),
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

      const loginResponse = await fetch('http://localhost:8000/api/v1/login/fido-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: encryptedCustomerId,
          credential: authData,
        }),
      });

      if (!loginResponse.ok) {
        const data = await loginResponse.json();
        throw new Error(data.detail || 'FIDO2 login failed.');
      }

      const { status, symmetric_key, seed_challenge } = await loginResponse.json();
      if (status !== 'fido_verified') {
        throw new Error('FIDO2 verification failed.');
      }

      const currentState = await checkDeviceState();
      if (!currentState) {
        setError('Failed to check device state. Ensure checker service is running on http://localhost:5000.');
        return;
      }

      const storedState = await loadDeviceState(customerId);
      if (storedState && storedState.biometric_hash !== currentState.current_hash) {
        setError(
          'WARNING: Device biometric state has changed! ' +
          `Stored hash: ${storedState.biometric_hash.slice(0, 16)}..., ` +
          `Current hash: ${currentState.current_hash.slice(0, 16)}..., ` +
          `Size change: ${storedState.database_size} → ${currentState.current_size} bytes. ` +
          'Please verify your seed phrase.'
        );
        setShowSeedInput(true);
        setIsLoading(false);
        return;
      }

      if (!showSeedInput) {
        onSuccess();
      }
    } catch (err) {
      setError(`FIDO2 login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleSeedVerification = async () => {
    setIsLoading(true);
    setError('');

    try {
      const seedKeys = await deriveKeys(seedPhrase);
      const encryptedCustomerId = await encrypt(customerId);
      const response = await fetch('http://localhost:8000/api/v1/login/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: encryptedCustomerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to start FIDO2 login for seed verification.');
      }

      const { seed_challenge } = await response.json();
      const challengeBytes = new TextEncoder().encode(seed_challenge);
      const signature = Buffer.from(
        await crypto.subtle.sign(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          await crypto.subtle.importKey(
            'raw',
            Buffer.from(seedKeys.privateKey, 'hex'),
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign']
          ),
          challengeBytes
        )
      ).toString('base64');

      const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: encryptedCustomerId,
          challenge: seed_challenge,
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.detail || 'Seed key verification failed.');
      }

      const currentState = await checkDeviceState();
      if (!currentState) {
        throw new Error('Failed to fetch device state.');
      }

      await saveDeviceState(customerId, currentState);
      console.log('Updated device state stored:', {
        current_hash: currentState.current_hash.slice(0, 16) + '...',
        current_size: currentState.current_size,
        timestamp: currentState.timestamp,
      });

      onSuccess();
    } catch (err) {
      setError(`Seed verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {showSeedInput ? 'Verify Seed Phrase' : 'FIDO2 Login'}
          </h1>
        </div>
        {!showSeedInput ? (
          <>
            <p className="text-muted-foreground mb-4">
              Authenticate using your biometric (fingerprint, face, or PIN).
            </p>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleFidoLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating...' : 'Login with Biometric'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              Device state has changed. Enter your seed phrase to verify and update the baseline.
            </p>
            <Input
              type="text"
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              placeholder="Enter your 12-word seed phrase"
              className="mb-4"
            />
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleSeedVerification}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify Seed Phrase'}
            </Button>
          </>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </Card>
    </div>
  );
};

export default FidoLogin;