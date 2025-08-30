import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, loadCustomerInfo, initIndexedDB } from '@/utils/deviceStateChecker';
import { checkDeviceState, loadDeviceState, checkWindowsHelloAvailability, loadCustomerInfo, initIndexedDB } from '@/utils/deviceStateChecker';
import { arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex, hexToArrayBuffer } from '@/utils/crypto';
import { useNavigate } from 'react-router-dom';
import { getPublicKey } from '@noble/secp256k1';
import { useAppContext } from '@/context/AppContext';

interface Account {
  account_number: string;
  account_type: string;
  balance: number;
  customer_id: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  account_number: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  terminal_id: string;
}

interface FidoLoginProps {
  onSuccess: (account?: Account) => void;
  customerName: string | null;
}

const FidoLogin = ({ onSuccess, customerName }: FidoLoginProps) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricMismatchPopup, setShowBiometricMismatchPopup] = useState(false);
  const [showAccountSelectionPopup, setShowAccountSelectionPopup] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const navigate = useNavigate();
  const { setSelectedAccount: setContextSelectedAccount } = useAppContext();

  const showBiometricMismatchError = async () => {
  const showBiometricMismatchError = async () => {
    setShowBiometricMismatchPopup(true);
    try {
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
      setError(`Error clearing storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async (customerId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/accounts/${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch accounts.');
      }
      const accountsData = await response.json();
      console.log('Fetched accounts:', accountsData);
      setAccounts(accountsData);
      setSelectedAccount('');
      return accountsData;
    } catch (err) {
      setError(`Failed to fetch accounts: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return [];
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

      const symmetricKeyBytes = base64urlToArrayBuffer(symmetric_key);
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
      } catch (err) {
        console.error('Symmetric Key Import Error:', err);
        throw new Error(`Failed to import symmetric key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      const storedKey = await loadCustomerInfo();
      if (!storedKey || !storedKey.encryptedPrivateKey) {
        throw new Error('Encrypted private key not found in IndexedDB.');
      }

      const { iv, encryptedData } = storedKey.encryptedPrivateKey;
      let decryptedPrivateKey;
      try {
        decryptedPrivateKey = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          symmetricKey,
          new Uint8Array(encryptedData)
        );
      } catch (err) {
        console.error('Decryption Error:', err);
        throw new Error(`Failed to decrypt private key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      let privateKeyBytes = decryptedPrivateKey;
      if (decryptedPrivateKey.byteLength === 64) {
        console.warn('Warning: Decrypted key is 64 bytes, likely a hex string. Converting to raw bytes.');
        try {
          const hexString = new TextDecoder().decode(decryptedPrivateKey);
          if (!/^[0-9a-fA-F]{64}$/.test(hexString)) {
            throw new Error('Decrypted data is not a valid 64-character hex string.');
          }
          privateKeyBytes = hexToArrayBuffer(hexString);
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
        const publicKey = getPublicKey(new Uint8Array(privateKeyBytes), true);
        publicKeyHex = arrayBufferToHex(publicKey);
      } catch (err) {
        console.error('Public Key Error:', err);
        throw new Error(`Failed to derive public key: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      const verifyPayload = {
        customer_id: customer_id,
        challenge: seed_challenge,
        public_key: publicKeyHex,
      };

      const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.detail || 'Seed key verification failed.');
      }

      const { token } = await verifyResponse.json();
      document.cookie = `auth_token=${token}; max-age=600; path=/; Secure; SameSite=Strict`;

      const accountsData = await fetchAccounts(customer_id);
      if (accountsData.length === 0) {
        setError('No accounts found for this customer.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setShowAccountSelectionPopup(true);
    } catch (err) {
      console.error('FIDO2 login error:', err);
      setError(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleAccountSelection = async () => {
    if (!selectedAccount) {
      setError('Please select an account to proceed.');
      return;
    }

    const account = accounts.find(acc => acc.account_number === selectedAccount);
    if (!account) {
      setError('Selected account not found.');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/v1/account/${selectedAccount}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch account details.');
      }
      const accountDetails = await response.json();
      setContextSelectedAccount(accountDetails);
      console.log('Selected account:', accountDetails);
      setShowAccountSelectionPopup(false);
      setError('');
      onSuccess(accountDetails);
      navigate("/dashboard");
    } catch (err) {
      setError(`Failed to fetch account details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCancelAccountSelection = () => {
    setShowAccountSelectionPopup(false);
    setSelectedAccount('');
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

      {showAccountSelectionPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md mx-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Select Your Account</h2>
              <p className="text-gray-600">
                You have {accounts.length} account{accounts.length > 1 ? 's' : ''} available.
                Please select one to proceed to the dashboard.
              </p>
            </div>
            <div className="mb-6">
              <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mb-2">
                Choose Account:
              </label>
              <select
                id="account-select"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select an account --</option>
                {accounts.map((account) => (
                  <option key={account.account_number} value={account.account_number}>
                    {account.account_type} - ***{account.account_number.slice(-4)} (${account.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            {selectedAccount && (
              <div className="mb-6 p-4 bg-blue-50 rounded-md border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Selected Account Details:</h3>
                {(() => {
                  const account = accounts.find(acc => acc.account_number === selectedAccount);
                  if (!account) return null;
                  return (
                    <div className="text-sm text-blue-700">
                      <p><strong>Type:</strong> {account.account_type}</p>
                      <p><strong>Account Number:</strong> {account.account_number}</p>
                      <p><strong>Balance:</strong> ${account.balance.toFixed(2)}</p>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={handleCancelAccountSelection}
              >
                Cancel
              </Button>
              <Button
                variant="banking"
                size="lg"
                className="flex-1"
                onClick={handleAccountSelection}
                disabled={!selectedAccount}
              >
                Proceed to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FidoLogin;


