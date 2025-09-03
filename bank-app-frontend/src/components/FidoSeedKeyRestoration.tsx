// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { encrypt } from '@/utils/encryption';
// import { deriveKeys, arrayBufferToBase64url, base64urlToArrayBuffer, hexToArrayBuffer } from '@/utils/crypto';
// import { storeKeyInIndexedDB, saveCustomerInfo, forceInitialize, checkDeviceState, saveDeviceState } from '@/utils/deviceStateChecker';
// import { useAppContext } from '@/context/AppContext';

// interface FidoSeedKeyRestorationProps {
//   onProceed: () => void;
//   phoneNumber: string;
//   customerId: string | undefined;
//   customerName: string;
// }

// const FidoSeedKeyRestoration = ({
//   onProceed,
//   phoneNumber,
//   customerId,
//   customerName,
// }: FidoSeedKeyRestorationProps) => {
//   const { setCustomerId, setCustomerName } = useAppContext();
//   const [step, setStep] = useState(1);
//   const [error, setError] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [seedWords, setSeedWords] = useState(Array(12).fill(''));
//   const [fidoData, setFidoData] = useState<{
//     credentialId: string;
//     publicKey: string;
//     symmetricKey: string;
//     clientDataJSON: string;
//     attestationObject: string;
//   } | null>(null);
//   const [name, setName] = useState(customerName);

//   useEffect(() => {
//     const storedName = localStorage.getItem('userName');
//     if (storedName) {
//       setName(storedName);
//       setCustomerName(storedName);
//     }
//   }, [setCustomerName]);

//   const handleFidoRegistration = async () => {
//     if (!window.PublicKeyCredential) {
//       setError('WebAuthn is not supported in this browser.');
//       return;
//     }

//     const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
//     if (!available) {
//       setError('Biometric authentication is not available on this device.');
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const encryptedCustomerId = await encrypt(customerId!);
//       const response = await fetch('http://localhost:8000/api/v1/restore/fido-start', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ customer_id: encryptedCustomerId }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to start FIDO2 restoration.');
//       }

//       const { rp, user, challenge, pubKeyCredParams, timeout, excludeCredentials, authenticatorSelection, attestation } = await response.json();

//       const creationOptions = {
//         challenge: base64urlToArrayBuffer(challenge),
//         rp,
//         user: { ...user, id: base64urlToArrayBuffer(user.id) },
//         pubKeyCredParams,
//         timeout,
//         excludeCredentials: excludeCredentials.map((cred: any) => ({
//           ...cred,
//           id: base64urlToArrayBuffer(cred.id),
//         })),
//         authenticatorSelection,
//         attestation,
//       };

//       const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
//       if (!credential) {
//         throw new Error('Failed to create credential.');
//       }

//       const responseData = credential.response as AuthenticatorAttestationResponse;
//       const publicKey = responseData.getPublicKey
//         ? arrayBufferToBase64url(responseData.getPublicKey()!)
//         : arrayBufferToBase64url(responseData.getPublicKey()!);

//       const symmetricKey = await crypto.subtle.generateKey(
//         { name: 'AES-GCM', length: 256 },
//         true,
//         ['encrypt', 'decrypt']
//       );
//       const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
//       if (exportedSymmetricKey.byteLength !== 32) {
//         throw new Error(`Invalid symmetric key length: ${exportedSymmetricKey.byteLength} bytes`);
//       }
//       const symmetricKeyBase64 = arrayBufferToBase64url(exportedSymmetricKey);

//       setFidoData({
//         credentialId: credential.id,
//         publicKey,
//         symmetricKey: symmetricKeyBase64,
//         clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
//         attestationObject: arrayBufferToBase64url(responseData.attestationObject),
//       });

//       setStep(2);
//     } catch (err) {
//       console.error('FIDO2 restoration error:', err);
//       setError(`FIDO2 restoration failed`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSeedPhraseSubmit = async () => {
//     setIsLoading(true);
//     setError('');

//     try {
//       const seedPhrase = seedWords.join(' ').trim();
//       if (seedWords.some(word => !word.trim()) || seedWords.length !== 12) {
//         throw new Error('Please enter all 12 seed phrase words.');
//       }

//       await forceInitialize();

//       const seedKeys = await deriveKeys(seedPhrase);
//       if (!fidoData) {
//         throw new Error('FIDO2 data not available.');
//       }

//       const privateKeyBytes = hexToArrayBuffer(seedKeys.privateKey);
//       if (privateKeyBytes.byteLength !== 32) {
//         throw new Error(`Invalid seed private key length: ${privateKeyBytes.byteLength} bytes`);
//       }

//       const iv = crypto.getRandomValues(new Uint8Array(12));
//       const symmetricKey = await crypto.subtle.importKey(
//         'raw',
//         base64urlToArrayBuffer(fidoData.symmetricKey),
//         { name: 'AES-GCM' },
//         true,
//         ['encrypt', 'decrypt']
//       );

//       const encryptedPrivateKey = await crypto.subtle.encrypt(
//         { name: 'AES-GCM', iv, tagLength: 128 },
//         symmetricKey,
//         privateKeyBytes
//       );
//       if (encryptedPrivateKey.byteLength !== 48) {
//         throw new Error(`Invalid encrypted private key length: ${encryptedPrivateKey.byteLength} bytes`);
//       }

//       const encryptedPayload = {
//         iv: Array.from(iv),
//         encryptedData: Array.from(new Uint8Array(encryptedPrivateKey)),
//       };

//       await storeKeyInIndexedDB(customerId!, encryptedPayload);
//       await saveCustomerInfo(customerId!, customerName, encryptedPayload);
//       setCustomerId(customerId!);
//       setCustomerName(customerName);

//       const encryptedPhoneNumber = await encrypt(phoneNumber);
//       const encryptedCustomerId = await encrypt(customerId!);
//       const encryptedCredentialId = await encrypt(fidoData.credentialId);
//       const encryptedFidoPublicKey = await encrypt(fidoData.publicKey);
//       const encryptedSymmetricKey = await encrypt(fidoData.symmetricKey);
//       const encryptedSeedUserId = await encrypt(seedKeys.userId);
//       const encryptedSeedPublicKey = await encrypt(seedKeys.publicKey);

//       const response = await fetch('http://localhost:8000/api/v1/restore/fido-seedkey', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           phoneNumber: encryptedPhoneNumber,
//           customerId: encryptedCustomerId,
//           fidoData: {
//             credentialId: encryptedCredentialId,
//             publicKey: encryptedFidoPublicKey,
//             symmetricKey: encryptedSymmetricKey,
//             clientDataJSON: fidoData.clientDataJSON,
//             attestationObject: fidoData.attestationObject,
//           },
//           seedData: {
//             userId: encryptedSeedUserId,
//             publicKey: encryptedSeedPublicKey,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to restore FIDO2 and seed key.');
//       }

//        const deviceCompleteResponse = await fetch('http://localhost:8000/api/v1/register/device-complete', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
//       });

//       if (!deviceCompleteResponse.ok) {
//         const data = await deviceCompleteResponse.json();
//         throw new Error(data.detail || 'Failed to complete device verification.');
//       }

//       // console.log('handleVerifyWords: Checking device state');
//       const deviceState = await checkDeviceState();
//       if (!deviceState) {
//         throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5050.');
//       }

//       // console.log('handleVerifyWords: Saving device state');
//       await saveDeviceState(customerId!, deviceState);

//       onProceed();
//     } catch (err) {
//       console.error('Seed phrase restoration error:', err);
//       setError(`Restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const renderSeedPhraseInput = () => {
//     return (
//       <div className="grid grid-cols-2 gap-2 mb-4">
//         {seedWords.map((word, index) => (
//           <div key={index} className="flex items-center">
//             <span className="w-8 text-sm text-muted-foreground">{`${index + 1}.`}</span>
//             <Input
//               type="text"
//               value={word}
//               onChange={(e) => {
//                 const newWords = [...seedWords];
//                 newWords[index] = e.target.value.trim();
//                 setSeedWords(newWords);
//               }}
//               placeholder={`Word ${index + 1}`}
//               className="h-10"
//             />
//           </div>
//         ))}
//       </div>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
//       <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
//         <div className="flex items-center mb-6">
//           <h1 className="text-2xl font-bold text-foreground">
//             {step === 1 ? 'FIDO2 Restoration' : 'Enter Seed Phrase'}
//           </h1>
//         </div>
//         {step === 1 && (
//           <>
//             <p className="text-muted-foreground mb-4">
//               Register a new biometric (fingerprint, face, or PIN) for restoration.
//             </p>
//             <Input
//               type="text"
//               value={name}
//               placeholder="Enter your name"
//               className="mb-4"
//               readOnly
//             />
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleFidoRegistration}
//               disabled={isLoading || !name}
//             >
//               {isLoading ? 'Registering...' : 'Register Biometric'}
//             </Button>
//           </>
//         )}
//         {step === 2 && (
//           <>
//             <p className="text-muted-foreground mb-4">
//               Enter your 12-word seed phrase to restore your account.
//             </p>
//             {renderSeedPhraseInput()}
//             {error && <p className="text-red-500 mb-4">{error}</p>}
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleSeedPhraseSubmit}
//               disabled={isLoading || seedWords.some(word => !word.trim())}
//             >
//               {isLoading ? 'Submitting...' : 'Submit Seed Phrase'}
//             </Button>
//           </>
//         )}
//         {error && step !== 2 && <p className="text-red-500 mb-4">{error}</p>}
//       </Card>
//     </div>
//   );
// };

// export default FidoSeedKeyRestoration;








// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { encrypt } from '@/utils/encryption';
// import { deriveKeys, arrayBufferToBase64url, base64urlToArrayBuffer, hexToArrayBuffer } from '@/utils/crypto';
// import { storeKeyInIndexedDB, saveCustomerInfo, forceInitialize, checkDeviceState, saveDeviceState } from '@/utils/deviceStateChecker';
// import { useAppContext } from '@/context/AppContext';
// import { toast } from 'sonner';
// import { 
//   AlertTriangle, 
//   Clock, 
//   Shield, 
//   CheckCircle, 
//   RefreshCw,
//   Lock,
//   Fingerprint
// } from 'lucide-react';

// interface FidoSeedKeyRestorationProps {
//   onProceed: () => void;
//   phoneNumber: string;
//   customerId: string | undefined;
//   customerName: string;
// }

// interface SeedkeyLockoutInfo {
//   is_locked: boolean;
//   failed_attempts: number;
//   attempts_remaining: number;
//   locked_until: string | null;
//   time_remaining_hours: number;
//   lockout_duration_hours: number;
// }

// const FidoSeedKeyRestoration = ({
//   onProceed,
//   phoneNumber,
//   customerId,
//   customerName,
// }: FidoSeedKeyRestorationProps) => {
//   const { setCustomerId, setCustomerName } = useAppContext();
//   const [step, setStep] = useState(1);
//   const [error, setError] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [seedWords, setSeedWords] = useState(Array(12).fill(''));
//   const [fidoData, setFidoData] = useState<{
//     credentialId: string;
//     publicKey: string;
//     symmetricKey: string;
//     clientDataJSON: string;
//     attestationObject: string;
//   } | null>(null);
//   const [name, setName] = useState(customerName);
  
//   // New states for seedkey attempt tracking
//   const [seedkeyLockoutInfo, setSeedkeyLockoutInfo] = useState<SeedkeyLockoutInfo | null>(null);
//   const [attemptsRemaining, setAttemptsRemaining] = useState(3);
//   const [timeRemaining, setTimeRemaining] = useState<string>('');
//   const [showLockoutWarning, setShowLockoutWarning] = useState(false);

//   useEffect(() => {
//     const storedName = localStorage.getItem('userName');
//     if (storedName) {
//       setName(storedName);
//       setCustomerName(storedName);
//     }
//   }, [setCustomerName]);

//   // Check seedkey lockout status on component mount
//   useEffect(() => {
//     const checkSeedkeyStatus = async () => {
//       if (!customerId) return;
      
//       try {
//         const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
//           method: 'GET',
//           headers: { 'Content-Type': 'application/json' }
//         });
        
//         if (response.ok) {
//           const data = await response.json();
//           setSeedkeyLockoutInfo(data);
//           setAttemptsRemaining(data.attempts_remaining || 3);
          
//           if (data.is_locked) {
//             setShowLockoutWarning(true);
//             setStep(1); // Keep on FIDO step if locked
//           }
//         }
//       } catch (error) {
//         console.error('Error checking seedkey status:', error);
//       }
//     };

//     checkSeedkeyStatus();
//   }, [customerId]);

//   // Update time remaining every minute if locked
//   useEffect(() => {
//     if (seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo.locked_until) {
//       const updateTimer = () => {
//         const now = new Date().getTime();
//         const lockEnd = new Date(seedkeyLockoutInfo.locked_until!).getTime();
//         const difference = lockEnd - now;
        
//         if (difference > 0) {
//           const hours = Math.floor(difference / (1000 * 60 * 60));
//           const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
//           setTimeRemaining(`${hours}h ${minutes}m`);
//         } else {
//           setTimeRemaining('Lockout expired');
//           setSeedkeyLockoutInfo(prev => prev ? { ...prev, is_locked: false } : null);
//           setShowLockoutWarning(false);
//         }
//       };

//       updateTimer();
//       const interval = setInterval(updateTimer, 60000); // Update every minute

//       return () => clearInterval(interval);
//     }
//   }, [seedkeyLockoutInfo]);

//   const handleFidoRegistration = async () => {
//     if (!window.PublicKeyCredential) {
//       setError('WebAuthn is not supported in this browser.');
//       return;
//     }

//     const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
//     if (!available) {
//       setError('Biometric authentication is not available on this device.');
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const encryptedCustomerId = await encrypt(customerId!);
//       const response = await fetch('http://localhost:8000/api/v1/restore/fido-start', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ customer_id: encryptedCustomerId }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to start FIDO2 restoration.');
//       }

//       const { rp, user, challenge, pubKeyCredParams, timeout, excludeCredentials, authenticatorSelection, attestation } = await response.json();

//       const creationOptions = {
//         challenge: base64urlToArrayBuffer(challenge),
//         rp,
//         user: { ...user, id: base64urlToArrayBuffer(user.id) },
//         pubKeyCredParams,
//         timeout,
//         excludeCredentials: excludeCredentials.map((cred: any) => ({
//           ...cred,
//           id: base64urlToArrayBuffer(cred.id),
//         })),
//         authenticatorSelection,
//         attestation,
//       };

//       const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
//       if (!credential) {
//         throw new Error('Failed to create credential.');
//       }

//       const responseData = credential.response as AuthenticatorAttestationResponse;
//       const publicKey = responseData.getPublicKey
//         ? arrayBufferToBase64url(responseData.getPublicKey()!)
//         : arrayBufferToBase64url(responseData.getPublicKey()!);

//       const symmetricKey = await crypto.subtle.generateKey(
//         { name: 'AES-GCM', length: 256 },
//         true,
//         ['encrypt', 'decrypt']
//       );
//       const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
//       if (exportedSymmetricKey.byteLength !== 32) {
//         throw new Error(`Invalid symmetric key length: ${exportedSymmetricKey.byteLength} bytes`);
//       }
//       const symmetricKeyBase64 = arrayBufferToBase64url(exportedSymmetricKey);

//       setFidoData({
//         credentialId: credential.id,
//         publicKey,
//         symmetricKey: symmetricKeyBase64,
//         clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
//         attestationObject: arrayBufferToBase64url(responseData.attestationObject),
//       });

//       toast.success('Biometric registration successful', {
//         description: 'New biometric credential registered for restoration'
//       });

//       setStep(2);
//     } catch (err) {
//       console.error('FIDO2 restoration error:', err);
//       setError(`FIDO2 restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSeedPhraseSubmit = async () => {
//     if (seedkeyLockoutInfo?.is_locked) {
//       setError('Seedkey verification is currently locked. Please wait for the lockout period to expire.');
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const seedPhrase = seedWords.join(' ').trim();
//       if (seedWords.some(word => !word.trim()) || seedWords.length !== 12) {
//         throw new Error('Please enter all 12 seed phrase words.');
//       }

//       await forceInitialize();

//       const seedKeys = await deriveKeys(seedPhrase);
//       if (!fidoData) {
//         throw new Error('FIDO2 data not available.');
//       }

//       const privateKeyBytes = hexToArrayBuffer(seedKeys.privateKey);
//       if (privateKeyBytes.byteLength !== 32) {
//         throw new Error(`Invalid seed private key length: ${privateKeyBytes.byteLength} bytes`);
//       }

//       const iv = crypto.getRandomValues(new Uint8Array(12));
//       const symmetricKey = await crypto.subtle.importKey(
//         'raw',
//         base64urlToArrayBuffer(fidoData.symmetricKey),
//         { name: 'AES-GCM' },
//         true,
//         ['encrypt', 'decrypt']
//       );

//       const encryptedPrivateKey = await crypto.subtle.encrypt(
//         { name: 'AES-GCM', iv, tagLength: 128 },
//         symmetricKey,
//         privateKeyBytes
//       );
//       if (encryptedPrivateKey.byteLength !== 48) {
//         throw new Error(`Invalid encrypted private key length: ${encryptedPrivateKey.byteLength} bytes`);
//       }

//       const encryptedPayload = {
//         iv: Array.from(iv),
//         encryptedData: Array.from(new Uint8Array(encryptedPrivateKey)),
//       };

//       await storeKeyInIndexedDB(customerId!, encryptedPayload);
//       await saveCustomerInfo(customerId!, customerName, encryptedPayload);
//       setCustomerId(customerId!);
//       setCustomerName(customerName);

//       const encryptedPhoneNumber = await encrypt(phoneNumber);
//       const encryptedCustomerId = await encrypt(customerId!);
//       const encryptedCredentialId = await encrypt(fidoData.credentialId);
//       const encryptedFidoPublicKey = await encrypt(fidoData.publicKey);
//       const encryptedSymmetricKey = await encrypt(fidoData.symmetricKey);
//       const encryptedSeedUserId = await encrypt(seedKeys.userId);
//       const encryptedSeedPublicKey = await encrypt(seedKeys.publicKey);

//       const response = await fetch("http://localhost:8000/api/v1/restore/fido-seedkey", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           phoneNumber: encryptedPhoneNumber,
//           customerId: encryptedCustomerId,
//           fidoData: {
//             credentialId: encryptedCredentialId,
//             publicKey: encryptedFidoPublicKey,
//             symmetricKey: encryptedSymmetricKey,
//             clientDataJSON: fidoData.clientDataJSON,
//             attestationObject: fidoData.attestationObject,
//           },
//           seedData: {
//             userId: encryptedSeedUserId,
//             publicKey: encryptedSeedPublicKey,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         setError(errorData.detail.message || "Restoration failed");
//         if (response.status === 422 && errorData.detail.attempts_remaining !== undefined) {
//           setAttemptsRemaining(errorData.detail.attempts_remaining);
//           toast.error('Incorrect seed phrase', {
//             description: `${errorData.detail.attempts_remaining} attempts remaining. SMS notification sent.`
//           });
//         } else if (response.status === 423) {
//           setSeedkeyLockoutInfo(errorData.detail.lockout_info);
//           setShowLockoutWarning(true);
//           toast.error('Seedkey verification locked', {
//             description: `Account locked for 24 hours after 3 failed attempts. SMS notification sent.`
//           });
//         }
//         return;
//       }

//       const result = await response.json();

//       const deviceCompleteResponse = await fetch('http://localhost:8000/api/v1/register/device-complete', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
//       });

//       if (!deviceCompleteResponse.ok) {
//         const data = await deviceCompleteResponse.json();
//         throw new Error(data.detail || 'Failed to complete device verification.');
//       }

//       const deviceState = await checkDeviceState();
//       if (!deviceState) {
//         throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5050.');
//       }

//       await saveDeviceState(customerId!, deviceState);

//       // Show success message with restoration limits info
//       toast.success('App restoration successful!', {
//         description: `SMS notification sent. ${result.restoration_limits?.message || 'Post-restoration security limits applied.'}`
//       });

//       onProceed();
//     } catch (err: any) {
//       console.error('Seed phrase restoration error:', err);
//       setError(`Restoration failed: ${err.message}`);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const renderSeedPhraseInput = () => {
//     return (
//       <div className="grid grid-cols-2 gap-2 mb-4">
//         {seedWords.map((word, index) => (
//           <div key={index} className="flex items-center">
//             <span className="w-8 text-sm text-muted-foreground">{`${index + 1}.`}</span>
//             <Input
//               type="text"
//               value={word}
//               onChange={(e) => {
//                 const newWords = [...seedWords];
//                 newWords[index] = e.target.value.trim();
//                 setSeedWords(newWords);
//               }}
//               placeholder={`Word ${index + 1}`}
//               className="h-10"
//               disabled={isLoading || seedkeyLockoutInfo?.is_locked}
//             />
//           </div>
//         ))}
//       </div>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
//       <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
//         <div className="flex items-center mb-6">
//           <h1 className="text-2xl font-bold text-foreground">
//             {step === 1 ? 'FIDO2 Restoration' : 'Enter Seed Phrase'}
//           </h1>
//         </div>

//         {/* Seedkey Lockout Warning */}
//         {showLockoutWarning && seedkeyLockoutInfo?.is_locked && (
//           <Alert className="mb-6 border-red-200 bg-red-50">
//             <AlertTriangle className="h-4 w-4 text-red-600" />
//             <AlertDescription className="text-red-800">
//               <div className="space-y-2">
//                 <p className="font-semibold">Seedkey Verification Locked</p>
//                 <p className="text-sm">
//                   Your account has been locked for 24 hours due to 3 consecutive incorrect seed phrase attempts.
//                 </p>
//                 {timeRemaining && (
//                   <div className="flex items-center space-x-2">
//                     <Clock className="w-4 h-4" />
//                     <span className="text-sm font-medium">Time remaining: {timeRemaining}</span>
//                   </div>
//                 )}
//                 <p className="text-xs">
//                   An SMS notification has been sent to your registered mobile number.
//                   You can try again after the lockout period expires.
//                 </p>
//               </div>
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* Attempts Warning */}
//         {step === 2 && attemptsRemaining < 3 && attemptsRemaining > 0 && !seedkeyLockoutInfo?.is_locked && (
//           <Alert className="mb-4 border-amber-200 bg-amber-50">
//             <AlertTriangle className="h-4 w-4 text-amber-600" />
//             <AlertDescription className="text-amber-800">
//               <p className="font-semibold">Warning: {attemptsRemaining} attempts remaining</p>
//               <p className="text-sm">
//                 After {attemptsRemaining} more incorrect attempts, your account will be locked for 24 hours.
//                 SMS notifications are being sent for each failed attempt.
//               </p>
//             </AlertDescription>
//           </Alert>
//         )}

//         {step === 1 && (
//           <>
//             <p className="text-muted-foreground mb-4">
//               Register a new biometric (fingerprint, face, or PIN) for restoration.
//             </p>
//             <Input
//               type="text"
//               value={name}
//               placeholder="Enter your name"
//               className="mb-4"
//               readOnly
//             />
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleFidoRegistration}
//               disabled={isLoading || !name}
//             >
//               {isLoading ? (
//                 <div className="flex items-center space-x-2">
//                   <RefreshCw className="w-4 h-4 animate-spin" />
//                   <span>Registering...</span>
//                 </div>
//               ) : (
//                 <div className="flex items-center space-x-2">
//                   <Fingerprint className="w-4 h-4" />
//                   <span>Register Biometric</span>
//                 </div>
//               )}
//             </Button>
//           </>
//         )}

//         {step === 2 && (
//           <>
//             <div className="mb-4">
//               <p className="text-muted-foreground mb-2">
//                 Enter your 12-word seed phrase to restore your account.
//               </p>
//               {!seedkeyLockoutInfo?.is_locked && (
//                 <div className="flex items-center space-x-2 mb-4">
//                   <Shield className="w-4 h-4 text-blue-600" />
//                   <span className="text-sm text-blue-800 font-medium">
//                     {attemptsRemaining} attempts remaining before lockout
//                   </span>
//                 </div>
//               )}
//             </div>
            
//             {renderSeedPhraseInput()}
            
//             {error && (
//               <Alert className="mb-4 border-red-200 bg-red-50">
//                 <AlertTriangle className="h-4 w-4 text-red-600" />
//                 <AlertDescription className="text-red-800">
//                   {error}
//                 </AlertDescription>
//               </Alert>
//             )}
            
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleSeedPhraseSubmit}
//               disabled={isLoading || seedWords.some(word => !word.trim()) || seedkeyLockoutInfo?.is_locked}
//             >
//               {isLoading ? (
//                 <div className="flex items-center space-x-2">
//                   <RefreshCw className="w-4 h-4 animate-spin" />
//                   <span>Submitting...</span>
//                 </div>
//               ) : seedkeyLockoutInfo?.is_locked ? (
//                 <div className="flex items-center space-x-2">
//                   <Lock className="w-4 h-4" />
//                   <span>Locked - Wait {timeRemaining}</span>
//                 </div>
//               ) : (
//                 <div className="flex items-center space-x-2">
//                   <CheckCircle className="w-4 h-4" />
//                   <span>Submit Seed Phrase</span>
//                 </div>
//               )}
//             </Button>

//             {seedkeyLockoutInfo?.is_locked && (
//               <div className="mt-4 p-3 bg-gray-50 rounded-lg">
//                 <p className="text-xs text-gray-600 text-center">
//                   <strong>Note:</strong> After the lockout period expires, you will have 3 new attempts to verify your seed phrase.
//                   Visit your nearest branch if you cannot remember your seed phrase.
//                 </p>
//               </div>
//             )}
//           </>
//         )}

//         {error && step !== 2 && (
//           <Alert className="mt-4 border-red-200 bg-red-50">
//             <AlertTriangle className="h-4 w-4 text-red-600" />
//             <AlertDescription className="text-red-800">
//               {error}
//             </AlertDescription>
//           </Alert>
//         )}

//         {step === 2 && (
//           <div className="mt-4 p-3 bg-blue-50 rounded-lg">
//             <div className="flex items-center space-x-2">
//               <Shield className="w-4 h-4 text-blue-600" />
//               <span className="text-xs text-blue-800 font-medium">Security Notice</span>
//             </div>
//             <p className="text-xs text-blue-700 mt-1">
//               SMS notifications are sent for all seed phrase verification attempts.
//               After successful restoration, transaction limits of ₹5,000 per transaction will be active for 35 hours.
//             </p>
//           </div>
//         )}
//       </Card>
//     </div>
//   );
// };

// export default FidoSeedKeyRestoration;










//Almost correct code

// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { encrypt } from '@/utils/encryption';
// import { deriveKeys, arrayBufferToBase64url, base64urlToArrayBuffer, hexToArrayBuffer } from '@/utils/crypto';
// import { storeKeyInIndexedDB, saveCustomerInfo, forceInitialize, checkDeviceState, saveDeviceState } from '@/utils/deviceStateChecker';
// import { useAppContext } from '@/context/AppContext';
// import { toast } from 'sonner';
// import { 
//   AlertTriangle, 
//   Clock, 
//   Shield, 
//   CheckCircle, 
//   RefreshCw,
//   Lock,
//   Fingerprint
// } from 'lucide-react';

// interface FidoSeedKeyRestorationProps {
//   onProceed: () => void;
//   phoneNumber: string;
//   customerId: string | undefined;
//   customerName: string;
// }

// interface SeedkeyLockoutInfo {
//   is_locked: boolean;
//   failed_attempts: number;
//   attempts_remaining: number;
//   locked_until: string | null;
//   time_remaining_hours: number;
//   lockout_duration_hours: number;
// }

// const FidoSeedKeyRestoration = ({
//   onProceed,
//   phoneNumber,
//   customerId,
//   customerName,
// }: FidoSeedKeyRestorationProps) => {
//   const { setCustomerId, setCustomerName } = useAppContext();
//   const [step, setStep] = useState(1);
//   const [error, setError] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [seedWords, setSeedWords] = useState(Array(12).fill(''));
//   const [fidoData, setFidoData] = useState<{
//     credentialId: string;
//     publicKey: string;
//     symmetricKey: string;
//     clientDataJSON: string;
//     attestationObject: string;
//   } | null>(null);
//   const [name, setName] = useState(customerName);
//   const [seedkeyLockoutInfo, setSeedkeyLockoutInfo] = useState<SeedkeyLockoutInfo | null>(null);

//   useEffect(() => {
//     const storedName = localStorage.getItem('userName');
//     if (storedName) {
//       setName(storedName);
//       setCustomerName(storedName);
//     }
//   }, [setCustomerName]);

//   // Check seedkey lockout status on component mount
//   useEffect(() => {
//     const checkSeedkeyStatus = async () => {
//       if (!customerId) return;
      
//       try {
//         const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
//           method: 'GET',
//           headers: { 'Content-Type': 'application/json' }
//         });
        
//         if (response.ok) {
//           const data = await response.json();
//           setSeedkeyLockoutInfo(data.seedkey_status);
//         } else {
//           throw new Error('Failed to fetch seedkey status');
//         }
//       } catch (error) {
//         console.error('Error checking seedkey status:', error);
//         toast.error('Failed to check seedkey status');
//       }
//     };

//     checkSeedkeyStatus();
//   }, [customerId]);

//   // Update time remaining every minute if locked
//   useEffect(() => {
//     if (seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo.locked_until) {
//       const updateTimer = () => {
//         const now = new Date().getTime();
//         const lockEnd = new Date(seedkeyLockoutInfo.locked_until!).getTime();
//         const difference = lockEnd - now;
        
//         if (difference > 0) {
//           const hours = Math.floor(difference / (1000 * 60 * 60));
//           const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
//           setSeedkeyLockoutInfo(prev => prev ? {
//             ...prev,
//             time_remaining_hours: hours + minutes / 60
//           } : null);
//         } else {
//           setSeedkeyLockoutInfo(prev => prev ? { 
//             ...prev, 
//             is_locked: false, 
//             locked_until: null, 
//             time_remaining_hours: 0,
//             failed_attempts: 0,
//             attempts_remaining: 3 
//           } : null);
//           toast.success('Lockout period expired', { 
//             description: 'You can now attempt seed phrase verification again.' 
//           });
//         }
//       };

//       updateTimer();
//       const interval = setInterval(updateTimer, 60000);
//       return () => clearInterval(interval);
//     }
//   }, [seedkeyLockoutInfo]);

//   const handleFidoRegistration = async () => {
//     if (!window.PublicKeyCredential) {
//       setError('WebAuthn is not supported in this browser.');
//       return;
//     }

//     const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
//     if (!available) {
//       setError('Biometric authentication is not available on this device.');
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const encryptedCustomerId = await encrypt(customerId!);
//       const response = await fetch('http://localhost:8000/api/v1/restore/fido-start', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ customer_id: encryptedCustomerId }),
//       });

//       if (!response.ok) {
//         const data = await response.json();
//         throw new Error(data.detail || 'Failed to start FIDO2 restoration.');
//       }

//       const { rp, user, challenge, pubKeyCredParams, timeout, excludeCredentials, authenticatorSelection, attestation } = await response.json();

//       const creationOptions = {
//         challenge: base64urlToArrayBuffer(challenge),
//         rp,
//         user: { ...user, id: base64urlToArrayBuffer(user.id) },
//         pubKeyCredParams,
//         timeout,
//         excludeCredentials: excludeCredentials.map((cred: any) => ({
//           ...cred,
//           id: base64urlToArrayBuffer(cred.id),
//         })),
//         authenticatorSelection,
//         attestation,
//       };

//       const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
//       if (!credential) {
//         throw new Error('Failed to create credential.');
//       }

//       const responseData = credential.response as AuthenticatorAttestationResponse;
//       const publicKey = responseData.getPublicKey
//         ? arrayBufferToBase64url(responseData.getPublicKey()!)
//         : arrayBufferToBase64url(responseData.getPublicKey()!);

//       const symmetricKey = await crypto.subtle.generateKey(
//         { name: 'AES-GCM', length: 256 },
//         true,
//         ['encrypt', 'decrypt']
//       );
//       const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
//       if (exportedSymmetricKey.byteLength !== 32) {
//         throw new Error(`Invalid symmetric key length: ${exportedSymmetricKey.byteLength} bytes`);
//       }
//       const symmetricKeyBase64 = arrayBufferToBase64url(exportedSymmetricKey);

//       setFidoData({
//         credentialId: credential.id,
//         publicKey,
//         symmetricKey: symmetricKeyBase64,
//         clientDataJSON: arrayBufferToBase64url(responseData.clientDataJSON),
//         attestationObject: arrayBufferToBase64url(responseData.attestationObject),
//       });

//       toast.success('Biometric registration successful', {
//         description: 'New biometric credential registered for restoration'
//       });

//       setStep(2);
//     } catch (err) {
//       console.error('FIDO2 restoration error:', err);
//       setError(`FIDO2 restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
//       toast.error('FIDO2 restoration failed', { description: err instanceof Error ? err.message : 'Unknown error' });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSeedPhraseSubmit = async () => {
//     if (seedkeyLockoutInfo?.is_locked) {
//       setError('Seedkey verification is currently locked. Please wait for the lockout period to expire.');
//       toast.error('Account locked', { description: 'Please wait for the lockout period to expire.' });
//       return;
//     }

//     setIsLoading(true);
//     setError('');

//     try {
//       const seedPhrase = seedWords.join(' ').trim();
//       if (seedWords.some(word => !word.trim()) || seedWords.length !== 12) {
//         throw new Error('Please enter all 12 seed phrase words.');
//       }

//       await forceInitialize();

//       // DUAL TRACKING: Client-side failures AND server-side failures both tracked
//       let seedKeys;
//       try {
//         seedKeys = await deriveKeys(seedPhrase, customerId!);
//       } catch (clientError: any) {
//         // Handle client-side failures with attempt tracking
//         console.error('Client-side seed phrase error:', clientError);
        
//         // Update UI based on client-side failure
//         if (clientError.message.includes('Account locked')) {
//           // Refresh lockout status from server
//           const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' }
//           });
          
//           if (response.ok) {
//             const data = await response.json();
//             setSeedkeyLockoutInfo(data.seedkey_status);
//             toast.error('Account locked for 24 hours', {
//               description: 'Too many failed attempts. SMS notification sent.'
//             });
//           }
//         } else if (clientError.message.includes('attempts remaining')) {
//           // Extract attempts remaining from error message
//           const match = clientError.message.match(/(\d+) attempts remaining/);
//           if (match) {
//             const attemptsRemaining = parseInt(match[1]);
//             setSeedkeyLockoutInfo(prev => prev ? {
//               ...prev,
//               attempts_remaining: attemptsRemaining,
//               failed_attempts: 3 - attemptsRemaining
//             } : {
//               is_locked: false,
//               failed_attempts: 3 - attemptsRemaining,
//               attempts_remaining: attemptsRemaining,
//               locked_until: null,
//               time_remaining_hours: 0,
//               lockout_duration_hours: 24
//             });
            
//             toast.error('Invalid seed phrase', {
//               description: `${attemptsRemaining} attempts remaining. SMS notification sent.`
//             });
//           }
//         }
        
//         setError(clientError.message);
//         return;
//       }
      
//       // Client-side validation passed, now proceed with server-side verification
//       if (!fidoData) {
//         throw new Error('FIDO2 data not available.');
//       }

//       const privateKeyBytes = hexToArrayBuffer(seedKeys.privateKey);
//       if (privateKeyBytes.byteLength !== 32) {
//         throw new Error(`Invalid seed private key length: ${privateKeyBytes.byteLength} bytes`);
//       }

//       const iv = crypto.getRandomValues(new Uint8Array(12));
//       const symmetricKey = await crypto.subtle.importKey(
//         'raw',
//         base64urlToArrayBuffer(fidoData.symmetricKey),
//         { name: 'AES-GCM' },
//         true,
//         ['encrypt', 'decrypt']
//       );

//       const encryptedPrivateKey = await crypto.subtle.encrypt(
//         { name: 'AES-GCM', iv, tagLength: 128 },
//         symmetricKey,
//         privateKeyBytes
//       );
//       if (encryptedPrivateKey.byteLength !== 48) {
//         throw new Error(`Invalid encrypted private key length: ${encryptedPrivateKey.byteLength} bytes`);
//       }

//       const encryptedPayload = {
//         iv: Array.from(iv),
//         encryptedData: Array.from(new Uint8Array(encryptedPrivateKey)),
//       };

//       await storeKeyInIndexedDB(customerId!, encryptedPayload);
//       await saveCustomerInfo(customerId!, customerName, encryptedPayload);
//       setCustomerId(customerId!);
//       setCustomerName(customerName);

//       const encryptedPhoneNumber = await encrypt(phoneNumber);
//       const encryptedCustomerId = await encrypt(customerId!);
//       const encryptedCredentialId = await encrypt(fidoData.credentialId);
//       const encryptedFidoPublicKey = await encrypt(fidoData.publicKey);
//       const encryptedSymmetricKey = await encrypt(fidoData.symmetricKey);
//       const encryptedSeedUserId = await encrypt(seedKeys.userId);
//       const encryptedSeedPublicKey = await encrypt(seedKeys.publicKey);

//       // Server-side verification call
//       const response = await fetch("http://localhost:8000/api/v1/restore/fido-seedkey", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           phoneNumber: encryptedPhoneNumber,
//           customerId: encryptedCustomerId,
//           fidoData: {
//             credentialId: encryptedCredentialId,
//             publicKey: encryptedFidoPublicKey,
//             symmetricKey: encryptedSymmetricKey,
//             clientDataJSON: fidoData.clientDataJSON,
//             attestationObject: fidoData.attestationObject,
//           },
//           seedData: {
//             userId: encryptedSeedUserId,
//             publicKey: encryptedSeedPublicKey,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
        
//         if (response.status === 422 && errorData.detail?.attempts_remaining !== undefined) {
//           // Server-side verification failure (seed keys don't match database)
//           const attemptsRemaining = errorData.detail.attempts_remaining;
//           const failedAttempts = errorData.detail.failed_attempts || (3 - attemptsRemaining);
          
//           setSeedkeyLockoutInfo({
//             is_locked: false,
//             failed_attempts: failedAttempts,
//             attempts_remaining: attemptsRemaining,
//             locked_until: null,
//             time_remaining_hours: 0,
//             lockout_duration_hours: 24
//           });
          
//           toast.error('Seed phrase verification failed', {
//             description: `${attemptsRemaining} attempts remaining. SMS notification sent.`
//           });
//           setError(`${errorData.detail.message}. ${attemptsRemaining} attempts remaining.`);
          
//         } else if (response.status === 423) {
//           // Server-side lockout
//           setSeedkeyLockoutInfo(errorData.detail.lockout_info);
//           toast.error('Account locked for 24 hours', {
//             description: 'Too many failed attempts. SMS notification sent.'
//           });
//           setError('Seedkey verification locked due to multiple failed attempts');
          
//         } else {
//           throw new Error(errorData.detail || 'Restoration failed');
//         }
//         return;
//       }

//       // SUCCESS - Continue with device registration
//       const result = await response.json();

//       const deviceCompleteResponse = await fetch('http://localhost:8000/api/v1/register/device-complete', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
//       });

//       if (!deviceCompleteResponse.ok) {
//         const data = await deviceCompleteResponse.json();
//         throw new Error(data.detail || 'Failed to complete device verification.');
//       }

//       const deviceState = await checkDeviceState();
//       if (!deviceState) {
//         throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5050.');
//       }

//       await saveDeviceState(customerId!, deviceState);

//       toast.success('App restoration successful!', {
//         description: `SMS notification sent. ${result.restoration_limits?.message || 'Post-restoration security limits applied.'}`
//       });

//       // Reset lockout info on success
//       setSeedkeyLockoutInfo({
//         is_locked: false,
//         failed_attempts: 0,
//         attempts_remaining: 3,
//         locked_until: null,
//         time_remaining_hours: 0,
//         lockout_duration_hours: 24
//       });

//       onProceed();
//     } catch (err: any) {
//       console.error('Seed phrase restoration error:', err);
//       setError(`Restoration failed: ${err.message}`);
//       toast.error('Restoration failed', { description: err.message });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const renderSeedPhraseInput = () => {
//     return (
//       <div className="grid grid-cols-2 gap-2 mb-4">
//         {seedWords.map((word, index) => (
//           <div key={index} className="flex items-center">
//             <span className="w-8 text-sm text-muted-foreground">{`${index + 1}.`}</span>
//             <Input
//               type="text"
//               value={word}
//               onChange={(e) => {
//                 const newWords = [...seedWords];
//                 newWords[index] = e.target.value.trim();
//                 setSeedWords(newWords);
//               }}
//               placeholder={`Word ${index + 1}`}
//               className="h-10"
//               disabled={isLoading || seedkeyLockoutInfo?.is_locked}
//             />
//           </div>
//         ))}
//       </div>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
//       <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
//         <div className="flex items-center mb-6">
//           <h1 className="text-2xl font-bold text-foreground">
//             {step === 1 ? 'FIDO2 Restoration' : 'Enter Seed Phrase'}
//           </h1>
//         </div>

//         {seedkeyLockoutInfo?.is_locked && (
//           <Alert className="mb-6 border-red-200 bg-red-50">
//             <AlertTriangle className="h-4 w-4 text-red-600" />
//             <AlertDescription className="text-red-800">
//               <div className="space-y-2">
//                 <p className="font-semibold">Account Locked</p>
//                 <p className="text-sm">
//                   Seedkey verification locked for 24 hours due to 3 consecutive incorrect attempts.
//                 </p>
//                 {seedkeyLockoutInfo.time_remaining_hours > 0 && (
//                   <div className="flex items-center space-x-2">
//                     <Clock className="w-4 h-4" />
//                     <span className="text-sm font-medium">
//                       Time remaining: {Math.floor(seedkeyLockoutInfo.time_remaining_hours)}h {Math.round((seedkeyLockoutInfo.time_remaining_hours % 1) * 60)}m
//                     </span>
//                   </div>
//                 )}
//                 <p className="text-xs">
//                   SMS notification sent to your registered number. You can try again after the lockout expires.
//                 </p>
//               </div>
//             </AlertDescription>
//           </Alert>
//         )}

//         {step === 2 && !seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo && seedkeyLockoutInfo.attempts_remaining < 3 && (
//           <Alert className="mb-4 border-amber-200 bg-amber-50">
//             <AlertTriangle className="h-4 w-4 text-amber-600" />
//             <AlertDescription className="text-amber-800">
//               <p className="font-semibold">Warning: {seedkeyLockoutInfo.attempts_remaining} attempts remaining</p>
//               <p className="text-sm">
//                 After {seedkeyLockoutInfo.attempts_remaining} more incorrect attempts, your account will be locked for 24 hours.
//                 SMS notifications are sent for each failed attempt.
//               </p>
//             </AlertDescription>
//           </Alert>
//         )}

//         {step === 1 && (
//           <>
//             <p className="text-muted-foreground mb-4">
//               Register a new biometric (fingerprint, face, or PIN) for restoration.
//             </p>
//             <Input
//               type="text"
//               value={name}
//               placeholder="Enter your name"
//               className="mb-4"
//               readOnly
//             />
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleFidoRegistration}
//               disabled={isLoading || !name}
//             >
//               {isLoading ? (
//                 <div className="flex items-center space-x-2">
//                   <RefreshCw className="w-4 h-4 animate-spin" />
//                   <span>Registering...</span>
//                 </div>
//               ) : (
//                 <div className="flex items-center space-x-2">
//                   <Fingerprint className="w-4 h-4" />
//                   <span>Register Biometric</span>
//                 </div>
//               )}
//             </Button>
//           </>
//         )}

//         {step === 2 && (
//           <>
//             <div className="mb-4">
//               <p className="text-muted-foreground mb-2">
//                 Enter your 12-word seed phrase to restore your account.
//               </p>
//               {!seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo && (
//                 <div className="flex items-center space-x-2 mb-4">
//                   <Shield className="w-4 h-4 text-blue-600" />
//                   <span className="text-sm text-blue-800 font-medium">
//                     {seedkeyLockoutInfo.attempts_remaining} attempts remaining before lockout
//                   </span>
//                 </div>
//               )}
//             </div>
            
//             {renderSeedPhraseInput()}
            
//             {error && (
//               <Alert className="mb-4 border-red-200 bg-red-50">
//                 <AlertTriangle className="h-4 w-4 text-red-600" />
//                 <AlertDescription className="text-red-800">
//                   {error}
//                 </AlertDescription>
//               </Alert>
//             )}
            
//             <Button
//               variant="banking"
//               size="xl"
//               className="w-full"
//               onClick={handleSeedPhraseSubmit}
//               disabled={isLoading || seedWords.some(word => !word.trim()) || seedkeyLockoutInfo?.is_locked}
//             >
//               {isLoading ? (
//                 <div className="flex items-center space-x-2">
//                   <RefreshCw className="w-4 h-4 animate-spin" />
//                   <span>Verifying...</span>
//                 </div>
//               ) : seedkeyLockoutInfo?.is_locked ? (
//                 <div className="flex items-center space-x-2">
//                   <Lock className="w-4 h-4" />
//                   <span>Locked - Wait {Math.floor(seedkeyLockoutInfo.time_remaining_hours)}h {Math.round((seedkeyLockoutInfo.time_remaining_hours % 1) * 60)}m</span>
//                 </div>
//               ) : (
//                 <div className="flex items-center space-x-2">
//                   <CheckCircle className="w-4 h-4" />
//                   <span>Verify Seed Phrase</span>
//                 </div>
//               )}
//             </Button>

//             {seedkeyLockoutInfo?.is_locked && (
//               <div className="mt-4 p-3 bg-gray-50 rounded-lg">
//                 <p className="text-xs text-gray-600 text-center">
//                   <strong>Note:</strong> After the lockout expires, you will have 3 new attempts to verify your seed phrase.
//                   Visit your nearest branch if you cannot remember your seed phrase.
//                 </p>
//               </div>
//             )}
//           </>
//         )}

//         {error && step !== 2 && (
//           <Alert className="mt-4 border-red-200 bg-red-50">
//             <AlertTriangle className="h-4 w-4 text-red-600" />
//             <AlertDescription className="text-red-800">
//               {error}
//             </AlertDescription>
//           </Alert>
//         )}

//         {step === 2 && (
//           <div className="mt-4 p-3 bg-blue-50 rounded-lg">
//             <div className="flex items-center space-x-2">
//               <Shield className="w-4 h-4 text-blue-600" />
//               <span className="text-xs text-blue-800 font-medium">Security Notice</span>
//             </div>
//             <p className="text-xs text-blue-700 mt-1">
//               SMS notifications are sent for all seed phrase verification attempts.
//               After successful restoration, transaction limits of ₹5,000 per transaction will be active for 35 hours.
//             </p>
//           </div>
//         )}
//       </Card>
//     </div>
//   );
// };

// export default FidoSeedKeyRestoration;




import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { encrypt } from '@/utils/encryption';
import { deriveKeys, arrayBufferToBase64url, base64urlToArrayBuffer, hexToArrayBuffer } from '@/utils/crypto';
import { storeKeyInIndexedDB, saveCustomerInfo, forceInitialize, checkDeviceState, saveDeviceState } from '@/utils/deviceStateChecker';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Clock, 
  Shield, 
  CheckCircle, 
  RefreshCw,
  Lock,
  Fingerprint
} from 'lucide-react';

interface FidoSeedKeyRestorationProps {
  onProceed: () => void;
  phoneNumber: string;
  customerId: string | undefined;
  customerName: string;
}

interface SeedkeyLockoutInfo {
  is_locked: boolean;
  failed_attempts: number;
  attempts_remaining: number;
  locked_until: string | null;
  time_remaining_hours: number;
  lockout_duration_hours: number;
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
  const [seedkeyLockoutInfo, setSeedkeyLockoutInfo] = useState<SeedkeyLockoutInfo | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setName(storedName);
      setCustomerName(storedName);
    }
  }, [setCustomerName]);

  // Check seedkey lockout status on component mount
  useEffect(() => {
    const checkSeedkeyStatus = async () => {
      if (!customerId) return;
      
      try {
        const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSeedkeyLockoutInfo(data.seedkey_status);
        } else {
          throw new Error('Failed to fetch seedkey status');
        }
      } catch (error) {
        console.error('Error checking seedkey status:', error);
        toast.error('Failed to check seedkey status');
      }
    };

    checkSeedkeyStatus();
  }, [customerId]);

  // Update time remaining every minute if locked
  useEffect(() => {
    if (seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo.locked_until) {
      const updateTimer = () => {
        const now = new Date().getTime();
        const lockEnd = new Date(seedkeyLockoutInfo.locked_until!).getTime();
        const difference = lockEnd - now;
        
        if (difference > 0) {
          const hours = Math.floor(difference / (1000 * 60 * 60));
          const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
          setSeedkeyLockoutInfo(prev => prev ? {
            ...prev,
            time_remaining_hours: hours + minutes / 60
          } : null);
        } else {
          setSeedkeyLockoutInfo(prev => prev ? { 
            ...prev, 
            is_locked: false, 
            locked_until: null, 
            time_remaining_hours: 0,
            failed_attempts: 0,
            attempts_remaining: 3 
          } : null);
          toast.success('Lockout period expired', { 
            description: 'You can now attempt seed phrase verification again.' 
          });
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    }
  }, [seedkeyLockoutInfo]);

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

      toast.success('Biometric registration successful', {
        description: 'New biometric credential registered for restoration'
      });

      setStep(2);
    } catch (err) {
      console.error('FIDO2 restoration error:', err);
      setError(`FIDO2 restoration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error('FIDO2 restoration failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedPhraseSubmit = async () => {
    if (seedkeyLockoutInfo?.is_locked) {
      setError('Seedkey verification is currently locked. Please wait for the lockout period to expire.');
      toast.error('Account locked', { description: 'Please wait for the lockout period to expire.' });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const seedPhrase = seedWords.join(' ').trim();
      if (seedWords.some(word => !word.trim()) || seedWords.length !== 12) {
        throw new Error('Please enter all 12 seed phrase words.');
      }

      await forceInitialize();

      // DUAL TRACKING: Client-side failures AND server-side failures both tracked
      let seedKeys;
      try {
        seedKeys = await deriveKeys(seedPhrase, customerId!);
      } catch (clientError: any) {
        // Handle client-side failures with attempt tracking
        console.error('Client-side seed phrase error:', clientError);
        
        // Update UI based on client-side failure
        if (clientError.message.includes('Account locked')) {
          // Refresh lockout status from server
          const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            setSeedkeyLockoutInfo(data.seedkey_status);
            toast.error('Account locked for 24 hours', {
              description: 'Too many failed attempts. SMS notification sent.'
            });
          }
        } else if (clientError.message.includes('attempts remaining')) {
          // Extract attempts remaining from error message
          const match = clientError.message.match(/(\d+) attempts remaining/);
          if (match) {
            const attemptsRemaining = parseInt(match[1]);
            setSeedkeyLockoutInfo(prev => prev ? {
              ...prev,
              attempts_remaining: attemptsRemaining,
              failed_attempts: 3 - attemptsRemaining
            } : {
              is_locked: false,
              failed_attempts: 3 - attemptsRemaining,
              attempts_remaining: attemptsRemaining,
              locked_until: null,
              time_remaining_hours: 0,
              lockout_duration_hours: 24
            });
            
            toast.error('Invalid seed phrase', {
              description: `${attemptsRemaining} attempts remaining. SMS notification sent.`
            });
          }
        }
        
        setError(clientError.message);
        return;
      }
      
      // Client-side validation passed, now proceed with server-side verification
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

      // Server-side verification call
      const response = await fetch("http://localhost:8000/api/v1/restore/fido-seedkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        const errorData = await response.json();
        
        if (response.status === 422 && errorData.detail?.attempts_remaining !== undefined) {
          // Server-side verification failure (seed keys don't match database)
          const attemptsRemaining = errorData.detail.attempts_remaining;
          const failedAttempts = errorData.detail.failed_attempts || (3 - attemptsRemaining);
          
          setSeedkeyLockoutInfo({
            is_locked: false,
            failed_attempts: failedAttempts,
            attempts_remaining: attemptsRemaining,
            locked_until: null,
            time_remaining_hours: 0,
            lockout_duration_hours: 24
          });
          
          toast.error('Seed phrase verification failed', {
            description: `${attemptsRemaining} attempts remaining. SMS notification sent.`
          });
          setError(`${errorData.detail.message}. ${attemptsRemaining} attempts remaining.`);
          
        } else if (response.status === 423) {
          // Server-side lockout
          setSeedkeyLockoutInfo(errorData.detail.lockout_info);
          toast.error('Account locked for 24 hours', {
            description: 'Too many failed attempts. SMS notification sent.'
          });
          setError('Seedkey verification locked due to multiple failed attempts');
          
        } else {
          throw new Error(errorData.detail || 'Restoration failed');
        }
        return;
      }

      // SUCCESS - Continue with device registration
      const result = await response.json();

      const deviceCompleteResponse = await fetch('http://localhost:8000/api/v1/register/device-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_phone_number: encryptedPhoneNumber }),
      });

      if (!deviceCompleteResponse.ok) {
        const data = await deviceCompleteResponse.json();
        throw new Error(data.detail || 'Failed to complete device verification.');
      }

      const deviceState = await checkDeviceState();
      if (!deviceState) {
        throw new Error('Failed to fetch device state. Ensure checker service is running on http://localhost:5050.');
      }

      await saveDeviceState(customerId!, deviceState);

      toast.success('App restoration successful!', {
        description: `SMS notification sent. ${result.restoration_limits?.message || 'Post-restoration security limits applied.'}`
      });

      // Reset lockout info on success
      setSeedkeyLockoutInfo({
        is_locked: false,
        failed_attempts: 0,
        attempts_remaining: 3,
        locked_until: null,
        time_remaining_hours: 0,
        lockout_duration_hours: 24
      });

      onProceed();
    } catch (err: any) {
      console.error('Seed phrase restoration error:', err);
      setError(`Restoration failed: ${err.message}`);
      toast.error('Restoration failed', { description: err.message });
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
              disabled={isLoading || seedkeyLockoutInfo?.is_locked}
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

        {seedkeyLockoutInfo?.is_locked && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
                <p className="font-semibold">Account Locked</p>
                <p className="text-sm">
                  Seedkey verification locked for 24 hours due to 3 consecutive incorrect attempts.
                </p>
                {seedkeyLockoutInfo.time_remaining_hours > 0 && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Time remaining: {Math.floor(seedkeyLockoutInfo.time_remaining_hours)}h {Math.round((seedkeyLockoutInfo.time_remaining_hours % 1) * 60)}m
                    </span>
                  </div>
                )}
                <p className="text-xs">
                  SMS notification sent to your registered number. You can try again after the lockout expires.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {step === 2 && !seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo && seedkeyLockoutInfo.attempts_remaining < 3 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <p className="font-semibold">Warning: {seedkeyLockoutInfo.attempts_remaining} attempts remaining</p>
              <p className="text-sm">
                After {seedkeyLockoutInfo.attempts_remaining} more incorrect attempts, your account will be locked for 24 hours.
                SMS notifications are sent for each failed attempt.
              </p>
            </AlertDescription>
          </Alert>
        )}

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
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Registering...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Fingerprint className="w-4 h-4" />
                  <span>Register Biometric</span>
                </div>
              )}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-4">
              <p className="text-muted-foreground mb-2">
                Enter your 12-word seed phrase to restore your account.
              </p>
              {!seedkeyLockoutInfo?.is_locked && seedkeyLockoutInfo && (
                <div className="flex items-center space-x-2 mb-4">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800 font-medium">
                    {seedkeyLockoutInfo.attempts_remaining} attempts remaining before lockout
                  </span>
                </div>
              )}
            </div>
            
            {renderSeedPhraseInput()}
            
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              variant="banking"
              size="xl"
              className="w-full"
              onClick={handleSeedPhraseSubmit}
              disabled={isLoading || seedWords.some(word => !word.trim()) || seedkeyLockoutInfo?.is_locked}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </div>
              ) : seedkeyLockoutInfo?.is_locked ? (
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Locked - Wait {Math.floor(seedkeyLockoutInfo.time_remaining_hours)}h {Math.round((seedkeyLockoutInfo.time_remaining_hours % 1) * 60)}m</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Verify Seed Phrase</span>
                </div>
              )}
            </Button>

            {seedkeyLockoutInfo?.is_locked && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 text-center">
                  <strong>Note:</strong> After the lockout expires, you will have 3 new attempts to verify your seed phrase.
                  Visit your nearest branch if you cannot remember your seed phrase.
                </p>
              </div>
            )}
          </>
        )}

        {error && step !== 2 && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {step === 2 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-800 font-medium">Security Notice</span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              SMS notifications are sent for all seed phrase verification attempts.
              After successful restoration, transaction limits of ₹5,000 per transaction will be active for 35 hours.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FidoSeedKeyRestoration;