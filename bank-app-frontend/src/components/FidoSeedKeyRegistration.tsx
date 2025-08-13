import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { encrypt } from '@/utils/encryption';
import { generateSeedPhrase, deriveKeys, getRandomWordIndices, hexToArrayBuffer, arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex } from '@/utils/crypto';
import { forceInitialize, checkDeviceState, saveDeviceState, storeKeyInIndexedDB, saveCustomerInfo } from '@/utils/deviceStateChecker';
import { useAppContext } from '@/context/AppContext';

interface FidoSeedKeyRegistrationProps {
  onProceed: () => void;
  phoneNumber: string;
  customerId: string | undefined;
  customerName: string;
}

const FidoSeedKeyRegistration = ({
  onProceed,
  phoneNumber,
  customerId,
  customerName,
}: FidoSeedKeyRegistrationProps) => {
  const { setCustomerId, setCustomerName } = useAppContext();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState('');
  const [verificationWords, setVerificationWords] = useState(['', '', '']);
  const [randomIndices, setRandomIndices] = useState<number[]>([]);
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
      const response = await fetch('http://localhost:8000/api/v1/register/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: encryptedCustomerId, name: customerName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to start FIDO2 registration.');
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
      // console.log('Generated Symmetric Key Bytes:', Array.from(new Uint8Array(exportedSymmetricKey)), 'Length:', exportedSymmetricKey.byteLength);
      if (exportedSymmetricKey.byteLength !== 32) {
        throw new Error(`Invalid symmetric key length: ${exportedSymmetricKey.byteLength} bytes`);
      }
      const symmetricKeyBase64 = arrayBufferToBase64url(exportedSymmetricKey);
      // console.log('Generated Symmetric Key Base64:', symmetricKeyBase64);

      setFidoData({
        credentialId: credential.id,
        publicKey,
        symmetricKey: symmetricKeyBase64,
        clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
        attestationObject: arrayBufferToBase64url(responseData.attestationObject),
      });

      setStep(2);
    } catch (err) {
      console.error('FIDO2 registration error:', err);
      setError(`FIDO2 registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSeed = () => {
    const mnemonic = generateSeedPhrase();
    setSeedPhrase(mnemonic);
    setStep(3);
  };

  const handleContinueToVerification = () => {
    const indices = getRandomWordIndices();
    setRandomIndices(indices);
    setStep(4);
  };

  const handleVerifyWords = async () => {
    const seedWords = seedPhrase.split(' ');
    const isValid = randomIndices.every(
      (index, i) => verificationWords[i].toLowerCase() === seedWords[index].toLowerCase()
    );

    if (!isValid) {
      setError('Incorrect verification words. Please try again.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // console.log('handleVerifyWords: Forcing database initialization');
      await forceInitialize();

      const seedKeys = await deriveKeys(seedPhrase);
      // console.log('Derived Seed Keys:', { userId: seedKeys.userId, privateKey: seedKeys.privateKey, publicKey: seedKeys.publicKey });

      if (!fidoData) {
        throw new Error('FIDO2 data not available.');
      }

      const privateKeyBytes = hexToArrayBuffer(seedKeys.privateKey);
      // console.log('Private Key Bytes:', Array.from(new Uint8Array(privateKeyBytes)), 'Length:', privateKeyBytes.byteLength);
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
      // console.log('Symmetric Key Imported:', fidoData.symmetricKey);

      const encryptedPrivateKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        symmetricKey,
        privateKeyBytes
      );
      // console.log('Private Key Encrypted, Length:', encryptedPrivateKey.byteLength);
      if (encryptedPrivateKey.byteLength !== 48) {
        throw new Error(`Invalid encrypted private key length: ${encryptedPrivateKey.byteLength} bytes, expected 48`);
      }

      const encryptedPayload = {
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedPrivateKey)),
      };
      // console.log('Encrypted Payload:', JSON.stringify(encryptedPayload, null, 2));

      // console.log('handleVerifyWords: Storing encrypted key for customerId:', customerId);
      await storeKeyInIndexedDB(customerId!, encryptedPayload);
      // console.log('handleVerifyWords: Saving customer info for customerId:', customerId);
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

      // console.log('handleVerifyWords: Sending FIDO2 and seed key registration to server');
      const response = await fetch('http://localhost:8000/api/v1/register/fido-seedkey', {
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
        throw new Error(data.detail || 'Failed to register FIDO2 and seed key.');
      }

      // console.log('handleVerifyWords: Completing device verification');
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
        throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5050.');
      }

      // console.log('handleVerifyWords: Saving device state');
      await saveDeviceState(customerId!, deviceState);

      // console.log('handleVerifyWords: Proceeding to next step');
      onProceed();
    } catch (err) {
      console.error('handleVerifyWords: Error:', err);
      setError(`Registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSeedGrid = () => {
    const words = seedPhrase.split(' ');
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {words.map((word, index) => (
          <div key={index} className="p-2 bg-gray-100 rounded-lg text-center" style={{ userSelect: 'none' }}>
            {`${index + 1}. ${word}`}
          </div>
        ))}
      </div>
    );
  };

  const renderVerificationGrid = () => {
    const words = seedPhrase.split(' ');
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {words.map((word, index) => (
          <div key={index} className="p-2 bg-gray-100 rounded-lg">
            {randomIndices.includes(index) ? (
              <Input
                type="text"
                value={verificationWords[randomIndices.indexOf(index)]}
                onChange={(e) => {
                  const newWords = [...verificationWords];
                  newWords[randomIndices.indexOf(index)] = e.target.value.trim();
                  setVerificationWords(newWords);
                }}
                placeholder={`Word ${index + 1}`}
                className="w-full"
              />
            ) : (
              <div style={{ userSelect: 'none' }}>{`${index + 1}. ${word}`}</div>
            )}
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
            {step === 1 ? 'FIDO2 Registration' : step === 2 ? 'Generate Seed Phrase' : step === 3 ? 'Save Seed Phrase' : 'Verify Seed Phrase'}
          </h1>
        </div>
        {step === 1 && (
          <>
            <p className="text-muted-foreground mb-4">
              Enter your name and register your biometric (fingerprint, face, or PIN).
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
              Click to generate a secure seed phrase for account recovery.
            </p>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleGenerateSeed}
              disabled={isLoading}
            >
              Generate Seed Phrase
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-muted-foreground mb-4">
              Write down this seed phrase securely. You will need it for account recovery.
            </p>
            {renderSeedGrid()}
            <p className="text-red-500 mb-4">This is your only chance to save these words!</p>
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleContinueToVerification}
              disabled={isLoading}
            >
              Continue to Verification
            </Button>
          </>
        )}
        {step === 4 && (
          <>
            <p className="text-muted-foreground mb-4">
              Enter the words at positions: {randomIndices.map(i => i + 1).join(', ')}
            </p>
            {renderVerificationGrid()}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleVerifyWords}
              disabled={isLoading}
            >
              {isLoading ? 'Submitting...' : 'Confirm Registration'}
            </Button>
          </>
        )}
        {error && step !== 4 && <p className="text-red-500 mb-4">{error}</p>}
      </Card>
    </div>
  );
};

export default FidoSeedKeyRegistration;