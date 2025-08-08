import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { encrypt } from '@/utils/encryption';
import { deriveKeys, arrayBufferToBase64url, base64urlToArrayBuffer, hexToArrayBuffer } from '@/utils/crypto';
import { storeKeyInIndexedDB, saveCustomerInfo, forceInitialize, checkDeviceState, saveDeviceState } from '@/utils/deviceStateChecker';
import { useAppContext } from '@/context/AppContext';

interface FidoSeedKeyRestorationProps {
  onProceed: () => void;
  phoneNumber: string;
  customerId: string | undefined;
  customerName: string;
}

const FidoSeedKeyRestoration = ({
  onProceed,
  phoneNumber,
  customerId,
  customerName,
}: FidoSeedKeyRestorationProps) => {
  const { setCustomerId, setCustomerName } = useAppContext();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [seedWords, setSeedWords] = useState(Array(12).fill(''));
  const [fidoData, setFidoData] = useState<{
    credentialId: string;
    publicKey: string;
    symmetricKey: string;
    clientDataJSON: string;
    attestationObject: string;
  } | null>(null);
  const [name, setName] = useState(customerName);

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setName(storedName);
      setCustomerName(storedName);
    }
  }, [setCustomerName]);

  const handleFidoRegistration = async () => {
    if (!window.PublicKeyCredential) {
      setError('WebAuthn is not supported in this browser.');
      return;
    }

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      setError('Biometric authentication is not available on this device.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const encryptedCustomerId = await encrypt(customerId!);
      const response = await fetch('http://localhost:8000/api/v1/restore/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: encryptedCustomerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to start FIDO2 restoration.');
      }

      const { rp, user, challenge, pubKeyCredParams, timeout, excludeCredentials, authenticatorSelection, attestation } = await response.json();

      const creationOptions = {
        challenge: base64urlToArrayBuffer(challenge),
        rp,
        user: { ...user, id: base64urlToArrayBuffer(user.id) },
        pubKeyCredParams,
        timeout,
        excludeCredentials: excludeCredentials.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id),
        })),
        authenticatorSelection,
        attestation,
      };

      const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
      if (!credential) {
        throw new Error('Failed to create credential.');
      }

      const responseData = credential.response as AuthenticatorAttestationResponse;
      const publicKey = responseData.getPublicKey
        ? arrayBufferToBase64url(responseData.getPublicKey()!)
        : arrayBufferToBase64url(responseData.getPublicKey()!);

      const symmetricKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
      if (exportedSymmetricKey.byteLength !== 32) {
        throw new Error(`Invalid symmetric key length: ${exportedSymmetricKey.byteLength} bytes`);
      }
      const symmetricKeyBase64 = arrayBufferToBase64url(exportedSymmetricKey);

      setFidoData({
        credentialId: credential.id,
        publicKey,
        symmetricKey: symmetricKeyBase64,
        clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
        attestationObject: arrayBufferToBase64url(responseData.attestationObject),
      });

      setStep(2);
    } catch (err) {
      console.error('FIDO2 restoration error:', err);
      setError(`FIDO2 restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedPhraseSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const seedPhrase = seedWords.join(' ').trim();
      if (seedWords.some(word => !word.trim()) || seedWords.length !== 12) {
        throw new Error('Please enter all 12 seed phrase words.');
      }

      await forceInitialize();

      const seedKeys = await deriveKeys(seedPhrase);
      if (!fidoData) {
        throw new Error('FIDO2 data not available.');
      }

      const privateKeyBytes = hexToArrayBuffer(seedKeys.privateKey);
      if (privateKeyBytes.byteLength !== 32) {
        throw new Error(`Invalid seed private key length: ${privateKeyBytes.byteLength} bytes`);
      }

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const symmetricKey = await crypto.subtle.importKey(
        'raw',
        base64urlToArrayBuffer(fidoData.symmetricKey),
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );

      const encryptedPrivateKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        symmetricKey,
        privateKeyBytes
      );
      if (encryptedPrivateKey.byteLength !== 48) {
        throw new Error(`Invalid encrypted private key length: ${encryptedPrivateKey.byteLength} bytes`);
      }

      const encryptedPayload = {
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedPrivateKey)),
      };

      await storeKeyInIndexedDB(customerId!, encryptedPayload);
      await saveCustomerInfo(customerId!, customerName, encryptedPayload);
      setCustomerId(customerId!);
      setCustomerName(customerName);

      const encryptedPhoneNumber = await encrypt(phoneNumber);
      const encryptedCustomerId = await encrypt(customerId!);
      const encryptedCredentialId = await encrypt(fidoData.credentialId);
      const encryptedFidoPublicKey = await encrypt(fidoData.publicKey);
      const encryptedSymmetricKey = await encrypt(fidoData.symmetricKey);
      const encryptedSeedUserId = await encrypt(seedKeys.userId);
      const encryptedSeedPublicKey = await encrypt(seedKeys.publicKey);

      const response = await fetch('http://localhost:8000/api/v1/restore/fido-seedkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: encryptedPhoneNumber,
          customerId: encryptedCustomerId,
          fidoData: {
            credentialId: encryptedCredentialId,
            publicKey: encryptedFidoPublicKey,
            symmetricKey: encryptedSymmetricKey,
            clientDataJSON: fidoData.clientDataJSON,
            attestationObject: fidoData.attestationObject,
          },
          seedData: {
            userId: encryptedSeedUserId,
            publicKey: encryptedSeedPublicKey,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to restore FIDO2 and seed key.');
      }

       const deviceCompleteResponse = await fetch('http://localhost:8000/api/v1/register/device-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
      });

      if (!deviceCompleteResponse.ok) {
        const data = await deviceCompleteResponse.json();
        throw new Error(data.detail || 'Failed to complete device verification.');
      }

      // console.log('handleVerifyWords: Checking device state');
      const deviceState = await checkDeviceState();
      if (!deviceState) {
        throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5000.');
      }

      // console.log('handleVerifyWords: Saving device state');
      await saveDeviceState(customerId!, deviceState);

      onProceed();
    } catch (err) {
      console.error('Seed phrase restoration error:', err);
      setError(`Restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSeedPhraseInput = () => {
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {seedWords.map((word, index) => (
          <div key={index} className="flex items-center">
            <span className="w-8 text-sm text-muted-foreground">{`${index + 1}.`}</span>
            <Input
              type="text"
              value={word}
              onChange={(e) => {
                const newWords = [...seedWords];
                newWords[index] = e.target.value.trim();
                setSeedWords(newWords);
              }}
              placeholder={`Word ${index + 1}`}
              className="h-10"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {step === 1 ? 'FIDO2 Restoration' : 'Enter Seed Phrase'}
          </h1>
        </div>
        {step === 1 && (
          <>
            <p className="text-muted-foreground mb-4">
              Register a new biometric (fingerprint, face, or PIN) for restoration.
            </p>
            <Input
              type="text"
              value={name}
              placeholder="Enter your name"
              className="mb-4"
              readOnly
            />
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleFidoRegistration}
              disabled={isLoading || !name}
            >
              {isLoading ? 'Registering...' : 'Register Biometric'}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-muted-foreground mb-4">
              Enter your 12-word seed phrase to restore your account.
            </p>
            {renderSeedPhraseInput()}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleSeedPhraseSubmit}
              disabled={isLoading || seedWords.some(word => !word.trim())}
            >
              {isLoading ? 'Submitting...' : 'Submit Seed Phrase'}
            </Button>
          </>
        )}
        {error && step !== 2 && <p className="text-red-500 mb-4">{error}</p>}
      </Card>
    </div>
  );
};

export default FidoSeedKeyRestoration;