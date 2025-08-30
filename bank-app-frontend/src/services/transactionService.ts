// --- File: src/services/transactionService.ts ---
import { useToast } from "@/components/ui/use-toast";
import { arrayBufferToBase64url, base64urlToArrayBuffer, arrayBufferToHex, hexToArrayBuffer } from '@/utils/crypto';
import { loadCustomerInfo, checkDeviceState } from '@/utils/deviceStateChecker';
import { getPublicKey } from '@noble/secp256k1';

export interface TransactionData {
  recipient_account_number: string;
  amount: number;
  terminal_id: string;
  biometric_hash: string;
  customer_id?: string; // Added for PIN verification
}

// New interface for PIN verification
export interface PinVerificationResult {
  verified: boolean;
  message: string;
  attempts_remaining?: number | null;
  locked_until?: string | null;
}

export class TransactionService {
  // Standard transaction execution
  static async executeTransaction(transactionData: TransactionData): Promise<any> {
    const token = this.getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found. Please log in again.");
    }

    const response = await fetch("http://localhost:8000/api/v1/transactions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication expired. Please log in again.");
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || "Transaction failed.");
    }

    return await response.json();
  }

  // NEW: PIN verification method
  static async verifyATMPin(customerId: string, pin: string, originalAlertId?: string): Promise<PinVerificationResult> {
    const token = this.getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found. Please log in again.");
    }

    console.log('🔐 [TransactionService] Verifying ATM PIN for customer:', customerId);

    try {
      const response = await fetch("http://localhost:8000/api/v1/transactions/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_id: customerId,
          atm_pin: pin,
          original_fraud_alert_id: originalAlertId
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication expired. Please log in again.");
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || "PIN verification failed.");
      }

      const result = await response.json();
      
      console.log('📊 [TransactionService] PIN verification result:', {
        verified: result.verified,
        attemptsRemaining: result.attempts_remaining,
        lockedUntil: result.locked_until
      });

      return {
        verified: result.verified,
        message: result.message,
        attempts_remaining: result.attempts_remaining,
        locked_until: result.locked_until
      };

    } catch (error) {
      console.error('❌ [TransactionService] PIN verification error:', error);
      throw error;
    }
  }

  // Enhanced re-authenticated transaction execution (with PIN verification flag)
  static async executeReauthenticatedTransaction(
    transactionData: TransactionData, 
    originalAlertId?: string,
    pinVerified: boolean = false
  ): Promise<any> {
    const token = this.getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found. Please log in again.");
    }

    console.log('💳 [TransactionService] Executing enhanced re-authenticated transaction:', {
      amount: transactionData.amount,
      recipient: transactionData.recipient_account_number,
      originalAlertId: originalAlertId || 'N/A',
      pinVerified: pinVerified,
      bypassFraudDetection: true
    });

    // Add re-authentication flags including PIN verification status
    const reauthTransactionData = {
      ...transactionData,
      is_reauth_transaction: true,
      pin_verified: pinVerified,
      original_fraud_alert_id: originalAlertId
    };

    const response = await fetch("http://localhost:8000/api/v1/transactions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(reauthTransactionData),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication expired. Please log in again.");
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || "Transaction failed.");
    }

    const result = await response.json();
    
    // Log successful re-authentication bypass
    if (result.fraud_detection_bypassed) {
      console.log('✅ [TransactionService] Fraud detection successfully bypassed for PIN + FIDO2 re-authenticated transaction');
    }

    return result;
  }

  // Enhanced FIDO2 authentication + re-authenticated transaction (with PIN pre-verification)
  static async executeWithFIDO2Auth(transactionData: TransactionData, originalAlertId?: string, pinVerified: boolean = true): Promise<any> {
    try {
      console.log('🔐 [TransactionService] Starting enhanced FIDO2 authentication for transaction retry');
      console.log('📋 [TransactionService] Enhanced transaction details:', {
        amount: transactionData.amount,
        recipient: transactionData.recipient_account_number,
        originalAlertId: originalAlertId || 'N/A',
        pinPreVerified: pinVerified
      });
      
      // Step 1: Perform complete FIDO2 authentication to get fresh token
      const authResult = await this.performCompleteFIDO2Login();
      if (!authResult.success) {
        throw new Error(authResult.error || "FIDO2 authentication failed");
      }

      console.log('✅ [TransactionService] FIDO2 authentication successful, executing enhanced re-authenticated transaction');

      // Step 2: Get fresh biometric hash
      const biometricResult = await this.getFreshBiometricHash();
      if (!biometricResult.success) {
        console.warn('⚠️ [TransactionService] Could not get fresh biometric hash, using existing');
      } else {
        console.log('🔍 [TransactionService] Fresh biometric hash obtained');
      }

      // Step 3: Update transaction data with fresh biometric hash
      const updatedTransactionData = {
        ...transactionData,
        biometric_hash: biometricResult.hash || transactionData.biometric_hash
      };

      console.log('💳 [TransactionService] Enhanced transaction data prepared:', {
        amount: updatedTransactionData.amount,
        recipient: updatedTransactionData.recipient_account_number,
        hasFreshBiometric: !!biometricResult.hash,
        originalAlertId: originalAlertId || 'N/A',
        pinVerified: pinVerified
      });

      // Step 4: Execute transaction as enhanced re-authenticated (bypasses fraud detection with PIN + FIDO2)
      const result = await this.executeReauthenticatedTransaction(updatedTransactionData, originalAlertId, pinVerified);

      // Step 5: Validate that fraud detection was bypassed
      if (result.fraud_detection_bypassed) {
        console.log('🎉 [TransactionService] Transaction completed successfully with PIN + FIDO2 fraud detection bypass');
      } else if (result.is_reauth_transaction) {
        console.log('✅ [TransactionService] Enhanced re-authenticated transaction completed successfully');
      }

      return result;
    } catch (error) {
      console.error('❌ [TransactionService] executeWithFIDO2Auth error:', error);
      throw error;
    }
  }

  // NEW: Complete PIN + FIDO2 authentication flow
  static async executeWithEnhancedAuth(
    transactionData: TransactionData, 
    originalAlertId?: string
  ): Promise<any> {
    try {
      console.log('🔐 [TransactionService] Starting complete PIN + FIDO2 authentication flow');

      // Get customer info for PIN verification
      const customerInfo = await loadCustomerInfo();
      if (!customerInfo || !customerInfo.customerId) {
        throw new Error('Customer information not found. Please log in again.');
      }

      const customerId = customerInfo.customerId;
      
      // This method assumes PIN has already been verified by the UI component
      // and is called with pinVerified=true flag
      return await this.executeWithFIDO2Auth(transactionData, originalAlertId, true);
      
    } catch (error) {
      console.error('❌ [TransactionService] Enhanced authentication failed:', error);
      throw error;
    }
  }

  // Complete FIDO2 authentication flow (same as before)
  private static async performCompleteFIDO2Login(): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🔐 [TransactionService] Starting complete FIDO2 login flow');

      // Check WebAuthn support
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser');
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error('Biometric authentication is not available on this device');
      }

      // Get customer info from IndexedDB
      const customerInfo = await loadCustomerInfo();
      if (!customerInfo || !customerInfo.customerId) {
        throw new Error('Customer information not found. Please log in again.');
      }

      const customerId = customerInfo.customerId;
      console.log('🔐 [TransactionService] Customer ID:', customerId);

      // Step 1: Start FIDO2 login
      console.log('🔐 [TransactionService] Starting FIDO2 login...');
      const startResponse = await fetch('http://localhost:8000/api/v1/login/fido-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });

      if (!startResponse.ok) {
        const data = await startResponse.json();
        throw new Error(data.detail || 'Failed to start FIDO2 authentication');
      }

      const { challenge, timeout, rpId, allowCredentials, userVerification } = await startResponse.json();

      // Step 2: Prepare authentication options
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

      console.log('🔐 [TransactionService] Prompting for biometric authentication...');

      // Step 3: Get credential (this opens Windows Hello/TouchID)
      const credential = await navigator.credentials.get({ publicKey: authOptions }) as PublicKeyCredential;
      if (!credential) {
        throw new Error('Biometric authentication was cancelled or failed');
      }

      console.log('✅ [TransactionService] Biometric credential obtained');

      // Step 4: Prepare auth data
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

      // Step 5: Complete FIDO2 authentication
      console.log('🔐 [TransactionService] Completing FIDO2 authentication...');
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
        throw new Error(data.detail || 'FIDO2 authentication failed');
      }

      const { status, symmetric_key, seed_challenge, customer_id } = await loginResponse.json();
      if (status !== 'fido_verified') {
        throw new Error('FIDO2 verification failed');
      }

      console.log('✅ [TransactionService] FIDO2 verified, proceeding to seed key verification...');

      // Step 6: Decrypt private key and derive public key
      const symmetricKeyBytes = base64urlToArrayBuffer(symmetric_key);
      if (symmetricKeyBytes.byteLength !== 32) {
        throw new Error(`Invalid symmetric key length: ${symmetricKeyBytes.byteLength} bytes`);
      }

      const symmetricKeyObj = await crypto.subtle.importKey(
        'raw',
        symmetricKeyBytes,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );

      if (!customerInfo.encryptedPrivateKey) {
        throw new Error('Encrypted private key not found');
      }

      const { iv, encryptedData } = customerInfo.encryptedPrivateKey;
      const decryptedPrivateKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        symmetricKeyObj,
        new Uint8Array(encryptedData)
      );

      let privateKeyBytes = decryptedPrivateKey;
      if (decryptedPrivateKey.byteLength === 64) {
        // Convert hex string to bytes if necessary
        const hexString = new TextDecoder().decode(decryptedPrivateKey);
        if (!/^[0-9a-fA-F]{64}$/.test(hexString)) {
          throw new Error('Invalid hex string in decrypted data');
        }
        privateKeyBytes = hexToArrayBuffer(hexString);
      }

      if (privateKeyBytes.byteLength !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyBytes.byteLength} bytes`);
      }

      // Derive public key
      const publicKey = getPublicKey(new Uint8Array(privateKeyBytes), true);
      const publicKeyHex = arrayBufferToHex(publicKey);

      // Step 7: Complete seed key verification
      console.log('🔐 [TransactionService] Verifying seed key...');
      const verifyResponse = await fetch('http://localhost:8000/api/v1/login/seedkey-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer_id,
          challenge: seed_challenge,
          public_key: publicKeyHex,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        let errorMessage = 'Seed key verification failed';
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map((err: any) => 
              `${err.loc?.join?.('.') || 'field'}: ${err.msg || 'validation error'}`
            ).join(', ');
            errorMessage = `Validation errors: ${validationErrors}`;
          }
        }
        throw new Error(errorMessage);
      }

      const { token } = await verifyResponse.json();
      
      // Step 8: Update auth token
      document.cookie = `auth_token=${token}; max-age=600; path=/; Secure; SameSite=Strict`;
      
      console.log('✅ [TransactionService] Complete FIDO2 authentication successful');
      return { success: true };

    } catch (error) {
      console.error('❌ [TransactionService] FIDO2 authentication failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Authentication failed';
      if (error instanceof Error) {
        if (error.message.includes('cancelled')) {
          errorMessage = 'Biometric authentication was cancelled by user';
        } else if (error.message.includes('not available')) {
          errorMessage = 'Biometric authentication is not available on this device';
        } else if (error.message.includes('not supported')) {
          errorMessage = 'WebAuthn is not supported in this browser';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  // Get fresh biometric hash from device checker
  private static async getFreshBiometricHash(): Promise<{success: boolean, hash?: string}> {
    try {
      console.log('🔍 [TransactionService] Getting fresh biometric hash...');
      const deviceState = await checkDeviceState();
      if (!deviceState || !deviceState.current_hash) {
        console.warn('⚠️ [TransactionService] No device state or hash available');
        return { success: false };
      }

      console.log('✅ [TransactionService] Fresh biometric hash obtained:', deviceState.current_hash.substring(0, 8) + '...');
      return { success: true, hash: deviceState.current_hash };
    } catch (error) {
      console.error('❌ [TransactionService] Error getting fresh biometric hash:', error);
      return { success: false };
    }
  }

  // Get authentication token from cookies
  private static getAuthToken(): string | null {
    try {
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];

      if (!cookieToken) {
        console.warn('⚠️ [TransactionService] No auth token found in cookies');
      }

      return cookieToken || null;
    } catch (error) {
      console.error('❌ [TransactionService] Error retrieving auth token:', error);
      return null;
    }
  }

  // Test transaction endpoint (enhanced with PIN info)
  static async testTransaction(transactionData: TransactionData): Promise<any> {
    const token = this.getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found. Please log in again.");
    }

    console.log('🧪 [TransactionService] Testing transaction without execution');

    const response = await fetch("http://localhost:8000/api/v1/transactions/test-fraud", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Test failed.");
    }

    return await response.json();
  }
}