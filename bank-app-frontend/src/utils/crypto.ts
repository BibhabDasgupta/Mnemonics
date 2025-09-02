// import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
// import { wordlist } from '@scure/bip39/wordlists/english';
// import { HDKey } from '@scure/bip32';
// import * as secp from '@noble/secp256k1';
// import { sha256 } from 'js-sha256';

// export const generateSeedPhrase = () => generateMnemonic(wordlist);

// export function arrayBufferToHex(buffer: ArrayBuffer): string {
//   return Array.from(new Uint8Array(buffer))
//     .map(b => b.toString(16).padStart(2, '0'))
//     .join('');
// }

// // Convert hex string to ArrayBuffer
// export function hexToArrayBuffer(hex: string): ArrayBuffer {
//   const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
//   return bytes.buffer;
// }

// // Convert ArrayBuffer to base64 (equivalent to Buffer.toString('base64'))
// export function arrayBufferToBase64(buffer: ArrayBuffer): string {
//   const bytes = new Uint8Array(buffer);
//   const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
//   return btoa(binary);
// }

// // Convert base64 string to ArrayBuffer (equivalent to Buffer.from(base64, 'base64'))
// export function base64ToArrayBuffer(base64: string): ArrayBuffer {
//   const binary = atob(base64);
//   const bytes = new Uint8Array(binary.length);
//   for (let i = 0; i < binary.length; i++) {
//     bytes[i] = binary.charCodeAt(i);
//   }
//   return bytes.buffer;
// }

// // Convert base64url to ArrayBuffer (already present in FidoLogin.tsx)
// export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
//   const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
//   return base64ToArrayBuffer(base64);
// }

// // Convert ArrayBuffer to base64url (already present in FidoLogin.tsx)
// export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
//   return arrayBufferToBase64(buffer)
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=/g, '');
// }

// export const deriveKeys = (mnemonic: string) => {
//   if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid seed phrase');

//   const seed = mnemonicToSeedSync(mnemonic);
//   const userId = sha256(seed);

//   const root = HDKey.fromMasterSeed(seed);
//   const child = root.derive(`m/44'/0'/0'/0/0`);
//   if (!child.privateKey) throw new Error('Derivation failed');

//   const publicKey = secp.getPublicKey(child.privateKey, true);

//   return {
//     userId,
//     privateKey: toHex(child.privateKey),
//     publicKey: toHex(publicKey),
//   };
// };

// export const verifySeedPhrase = (mnemonic: string, storedUserId: string, storedPublicKey: string) => {
//   try {
//     const { userId, publicKey } = deriveKeys(mnemonic);
//     return userId === storedUserId && publicKey === storedPublicKey;
//   } catch {
//     return false;
//   }
// };

// export const getRandomWordIndices = () => {
//   const indices = new Set<number>();
//   while (indices.size < 3) {
//     indices.add(Math.floor(Math.random() * 12));
//   }
//   return [...indices].sort((a, b) => a - b);
// };

// const toHex = (bytes: Uint8Array) => 
//   Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');













//Almost correct one

// import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
// import { wordlist } from '@scure/bip39/wordlists/english';
// import { HDKey } from '@scure/bip32';
// import * as secp from '@noble/secp256k1';
// import { sha256 } from 'js-sha256';

// // Interface for lockout information
// interface MnemonicLockoutInfo {
//   is_locked: boolean;
//   failed_attempts: number;
//   attempts_remaining: number;
//   locked_until: string | null;
//   lockout_duration_hours: number;
// }

// export const generateSeedPhrase = () => generateMnemonic(wordlist);

// export function arrayBufferToHex(buffer: ArrayBuffer): string {
//   return Array.from(new Uint8Array(buffer))
//     .map(b => b.toString(16).padStart(2, '0'))
//     .join('');
// }

// // Convert hex string to ArrayBuffer
// export function hexToArrayBuffer(hex: string): ArrayBuffer {
//   const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
//   return bytes.buffer;
// }

// // Convert ArrayBuffer to base64
// export function arrayBufferToBase64(buffer: ArrayBuffer): string {
//   const bytes = new Uint8Array(buffer);
//   const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
//   return btoa(binary);
// }

// // Convert base64 string to ArrayBuffer
// export function base64ToArrayBuffer(base64: string): ArrayBuffer {
//   const binary = atob(base64);
//   const bytes = new Uint8Array(binary.length);
//   for (let i = 0; i < binary.length; i++) {
//     bytes[i] = binary.charCodeAt(i);
//   }
//   return bytes.buffer;
// }

// // Convert base64url to ArrayBuffer
// export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
//   const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
//   return base64ToArrayBuffer(base64);
// }

// // Convert ArrayBuffer to base64url
// export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
//   return arrayBufferToBase64(buffer)
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=/g, '');
// }

// // WITH ATTEMPT TRACKING: Handle client-side failures with backend logging
// export const deriveKeys = async (mnemonic: string, customerId: string) => {
//   // Check if mnemonic verification is locked out
//   const lockoutStatus = await checkMnemonicLockout(customerId);
//   if (lockoutStatus.is_locked) {
//     throw new Error(`Account locked until ${lockoutStatus.locked_until ? new Date(lockoutStatus.locked_until).toLocaleString() : 'unknown time'}`);
//   }

//   // Validate mnemonic format
//   if (!validateMnemonic(mnemonic, wordlist)) {
//     // Log failed attempt for invalid format
//     const attemptResult = await logMnemonicAttempt(customerId, false, 'Invalid seed phrase format');
//     const errorMessage = attemptResult.is_blocked 
//       ? 'Account locked for 24 hours after 3 failed attempts'
//       : `Invalid seed phrase format. ${attemptResult.attempts_remaining} attempts remaining`;
    
//     throw new Error(errorMessage);
//   }

//   try {
//     const seed = mnemonicToSeedSync(mnemonic);
//     const userId = sha256(seed);

//     const root = HDKey.fromMasterSeed(seed);
//     const child = root.derive(`m/44'/0'/0'/0/0`);
//     if (!child.privateKey) {
//       // Log failed attempt for derivation failure
//       const attemptResult = await logMnemonicAttempt(customerId, false, 'Key derivation failed');
//       const errorMessage = attemptResult.is_blocked 
//         ? 'Account locked for 24 hours after 3 failed attempts'
//         : `Key derivation failed. ${attemptResult.attempts_remaining} attempts remaining`;
      
//       throw new Error(errorMessage);
//     }

//     const publicKey = secp.getPublicKey(child.privateKey, true);

//     // Log successful attempt
//     await logMnemonicAttempt(customerId, true);

//     return {
//       userId,
//       privateKey: toHex(child.privateKey),
//       publicKey: toHex(publicKey),
//     };
//   } catch (error) {
//     // If it's already our custom error with attempt info, re-throw it
//     if (error instanceof Error && (error.message.includes('attempts remaining') || error.message.includes('Account locked'))) {
//       throw error;
//     }
    
//     // Log failed attempt for other errors
//     const attemptResult = await logMnemonicAttempt(customerId, false, error instanceof Error ? error.message : 'Unknown derivation error');
//     const errorMessage = attemptResult.is_blocked 
//       ? 'Account locked for 24 hours after 3 failed attempts'
//       : `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}. ${attemptResult.attempts_remaining} attempts remaining`;
    
//     throw new Error(errorMessage);
//   }
// };

// export const verifySeedPhrase = async (mnemonic: string, storedUserId: string, storedPublicKey: string, customerId: string) => {
//   // Check lockout status
//   const lockoutStatus = await checkMnemonicLockout(customerId);
//   if (lockoutStatus.is_locked) {
//     return {
//       isValid: false,
//       lockoutInfo: lockoutStatus,
//     };
//   }

//   try {
//     const { userId, publicKey } = await deriveKeys(mnemonic, customerId);
//     const isValid = userId === storedUserId && publicKey === storedPublicKey;

//     if (!isValid) {
//       const attemptResult = await logMnemonicAttempt(customerId, false, 'Seed phrase does not match stored keys');
//       return {
//         isValid: false,
//         lockoutInfo: {
//           is_locked: attemptResult.is_blocked,
//           failed_attempts: attemptResult.failed_attempts,
//           attempts_remaining: attemptResult.attempts_remaining,
//           locked_until: attemptResult.locked_until,
//           lockout_duration_hours: attemptResult.lockout_duration_hours,
//         },
//       };
//     }

//     // Reset attempts on success
//     await logMnemonicAttempt(customerId, true);
//     return { isValid: true };
//   } catch (error) {
//     // Handle errors from deriveKeys that already include attempt tracking
//     if (error instanceof Error && (error.message.includes('attempts remaining') || error.message.includes('Account locked'))) {
//       return {
//         isValid: false,
//         error: error.message,
//         lockoutInfo: await checkMnemonicLockout(customerId)
//       };
//     }
    
//     const attemptResult = await logMnemonicAttempt(customerId, false, error instanceof Error ? error.message : 'Unknown error');
//     return {
//       isValid: false,
//       lockoutInfo: {
//         is_locked: attemptResult.is_blocked,
//         failed_attempts: attemptResult.failed_attempts,
//         attempts_remaining: attemptResult.attempts_remaining,
//         locked_until: attemptResult.locked_until,
//         lockout_duration_hours: attemptResult.lockout_duration_hours,
//       },
//     };
//   }
// };

// export const getRandomWordIndices = () => {
//   const indices = new Set<number>();
//   while (indices.size < 3) {
//     indices.add(Math.floor(Math.random() * 12));
//   }
//   return [...indices].sort((a, b) => a - b);
// };

// const toHex = (bytes: Uint8Array) => 
//   Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

// // Check mnemonic lockout status
// const checkMnemonicLockout = async (customerId: string): Promise<MnemonicLockoutInfo> => {
//   try {
//     const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json' },
//     });

//     if (!response.ok) {
//       throw new Error('Failed to fetch lockout status');
//     }

//     const data = await response.json();
//     return {
//       is_locked: data.seedkey_status.is_locked,
//       failed_attempts: data.seedkey_status.failed_attempts,
//       attempts_remaining: data.seedkey_status.attempts_remaining,
//       locked_until: data.seedkey_status.locked_until,
//       lockout_duration_hours: data.seedkey_status.lockout_duration_hours,
//     };
//   } catch (error) {
//     console.error('Error checking mnemonic lockout:', error);
//     return {
//       is_locked: false,
//       failed_attempts: 0,
//       attempts_remaining: 3,
//       locked_until: null,
//       lockout_duration_hours: 24,
//     };
//   }
// };

// // Log mnemonic attempt and handle SMS notifications
// const logMnemonicAttempt = async (
//   customerId: string,
//   success: boolean,
//   failureReason?: string
// ): Promise<{
//   is_blocked: boolean;
//   failed_attempts: number;
//   attempts_remaining: number;
//   locked_until: string | null;
//   lockout_duration_hours: number;
// }> => {
//   try {
//     const deviceInfo = getDeviceInfo();
//     const response = await fetch('http://localhost:8000/api/v1/restore/log-mnemonic-attempt', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         customerId,
//         success,
//         failureReason,
//         deviceInfo: {
//           ip_address: deviceInfo.ip_address,
//           user_agent: deviceInfo.user_agent,
//           device_info: deviceInfo.device_info,
//           location: deviceInfo.location,
//         },
//       }),
//     });

//     if (!response.ok) {
//       throw new Error('Failed to log mnemonic attempt');
//     }

//     const data = await response.json();
//     return {
//       is_blocked: data.is_blocked,
//       failed_attempts: data.failed_attempts,
//       attempts_remaining: data.attempts_remaining,
//       locked_until: data.locked_until,
//       lockout_duration_hours: data.lockout_duration_hours,
//     };
//   } catch (error) {
//     console.error('Error logging mnemonic attempt:', error);
//     return {
//       is_blocked: false,
//       failed_attempts: 0,
//       attempts_remaining: 3,
//       locked_until: null,
//       lockout_duration_hours: 24,
//     };
//   }
// };

// // Utility to get device information
// const getDeviceInfo = (): {
//   user_agent: string;
//   ip_address: string;
//   device_info: string;
//   location: string;
// } => {
//   const userAgent = navigator.userAgent || 'Unknown';
//   let deviceInfo = 'Unknown Device';
//   if (/Chrome/.test(userAgent)) deviceInfo = 'Chrome Browser';
//   else if (/Firefox/.test(userAgent)) deviceInfo = 'Firefox Browser';
//   else if (/Safari/.test(userAgent)) deviceInfo = 'Safari Browser';
//   else if (/Edge/.test(userAgent)) deviceInfo = 'Edge Browser';

//   return {
//     user_agent: userAgent,
//     ip_address: 'Unknown',
//     device_info: deviceInfo,
//     location: 'Unknown',
//   };
// };




import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import * as secp from '@noble/secp256k1';
import { sha256 } from 'js-sha256';

// Interface for lockout information
interface MnemonicLockoutInfo {
  is_locked: boolean;
  failed_attempts: number;
  attempts_remaining: number;
  locked_until: string | null;
  lockout_duration_hours: number;
}

export const generateSeedPhrase = () => generateMnemonic(wordlist);

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to ArrayBuffer
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  return bytes.buffer;
}

// Convert ArrayBuffer to base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert base64url to ArrayBuffer
export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToArrayBuffer(base64);
}

// Convert ArrayBuffer to base64url
export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// COORDINATED CLIENT-SIDE TRACKING: Handle client-side failures with proper coordination
export const deriveKeys = async (mnemonic: string, customerId: string) => {
  // Check if mnemonic verification is locked out FIRST
  const lockoutStatus = await checkMnemonicLockout(customerId);
  if (lockoutStatus.is_locked) {
    throw new Error(`Account locked until ${lockoutStatus.locked_until ? new Date(lockoutStatus.locked_until).toLocaleString() : 'unknown time'}`);
  }

  // Validate mnemonic format
  if (!validateMnemonic(mnemonic, wordlist)) {
    // Log CLIENT-SIDE failed attempt for invalid format
    const attemptResult = await logMnemonicAttempt(customerId, false, 'Invalid seed phrase format');
    const errorMessage = attemptResult.is_blocked 
      ? 'Account locked for 24 hours after 3 failed attempts'
      : `Invalid seed phrase format. ${attemptResult.attempts_remaining} attempts remaining`;
    
    throw new Error(errorMessage);
  }

  try {
    const seed = mnemonicToSeedSync(mnemonic);
    const userId = sha256(seed);

    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/0'/0'/0/0`);
    if (!child.privateKey) {
      // Log CLIENT-SIDE failed attempt for derivation failure
      const attemptResult = await logMnemonicAttempt(customerId, false, 'Key derivation failed');
      const errorMessage = attemptResult.is_blocked 
        ? 'Account locked for 24 hours after 3 failed attempts'
        : `Key derivation failed. ${attemptResult.attempts_remaining} attempts remaining`;
      
      throw new Error(errorMessage);
    }

    const publicKey = secp.getPublicKey(child.privateKey, true);

    // SUCCESS: Don't log here, let server handle success logging after verification
    return {
      userId,
      privateKey: toHex(child.privateKey),
      publicKey: toHex(publicKey),
    };
  } catch (error) {
    // If it's already our custom error with attempt info, re-throw it
    if (error instanceof Error && (error.message.includes('attempts remaining') || error.message.includes('Account locked'))) {
      throw error;
    }
    
    // Log CLIENT-SIDE failed attempt for other errors
    const attemptResult = await logMnemonicAttempt(customerId, false, error instanceof Error ? error.message : 'Unknown derivation error');
    const errorMessage = attemptResult.is_blocked 
      ? 'Account locked for 24 hours after 3 failed attempts'
      : `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}. ${attemptResult.attempts_remaining} attempts remaining`;
    
    throw new Error(errorMessage);
  }
};

export const verifySeedPhrase = async (mnemonic: string, storedUserId: string, storedPublicKey: string, customerId: string) => {
  // Check lockout status
  const lockoutStatus = await checkMnemonicLockout(customerId);
  if (lockoutStatus.is_locked) {
    return {
      isValid: false,
      lockoutInfo: lockoutStatus,
    };
  }

  try {
    const { userId, publicKey } = await deriveKeys(mnemonic, customerId);
    const isValid = userId === storedUserId && publicKey === storedPublicKey;

    if (!isValid) {
      const attemptResult = await logMnemonicAttempt(customerId, false, 'Seed phrase does not match stored keys');
      return {
        isValid: false,
        lockoutInfo: {
          is_locked: attemptResult.is_blocked,
          failed_attempts: attemptResult.failed_attempts,
          attempts_remaining: attemptResult.attempts_remaining,
          locked_until: attemptResult.locked_until,
          lockout_duration_hours: attemptResult.lockout_duration_hours,
        },
      };
    }

    // Reset attempts on success
    await logMnemonicAttempt(customerId, true);
    return { isValid: true };
  } catch (error) {
    // Handle errors from deriveKeys that already include attempt tracking
    if (error instanceof Error && (error.message.includes('attempts remaining') || error.message.includes('Account locked'))) {
      return {
        isValid: false,
        error: error.message,
        lockoutInfo: await checkMnemonicLockout(customerId)
      };
    }
    
    const attemptResult = await logMnemonicAttempt(customerId, false, error instanceof Error ? error.message : 'Unknown error');
    return {
      isValid: false,
      lockoutInfo: {
        is_locked: attemptResult.is_blocked,
        failed_attempts: attemptResult.failed_attempts,
        attempts_remaining: attemptResult.attempts_remaining,
        locked_until: attemptResult.locked_until,
        lockout_duration_hours: attemptResult.lockout_duration_hours,
      },
    };
  }
};

export const getRandomWordIndices = () => {
  const indices = new Set<number>();
  while (indices.size < 3) {
    indices.add(Math.floor(Math.random() * 12));
  }
  return [...indices].sort((a, b) => a - b);
};

const toHex = (bytes: Uint8Array) => 
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

// Check mnemonic lockout status
const checkMnemonicLockout = async (customerId: string): Promise<MnemonicLockoutInfo> => {
  try {
    const response = await fetch(`http://localhost:8000/api/v1/restore/seedkey-status/${customerId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch lockout status');
    }

    const data = await response.json();
    return {
      is_locked: data.seedkey_status.is_locked,
      failed_attempts: data.seedkey_status.failed_attempts,
      attempts_remaining: data.seedkey_status.attempts_remaining,
      locked_until: data.seedkey_status.locked_until,
      lockout_duration_hours: data.seedkey_status.lockout_duration_hours,
    };
  } catch (error) {
    console.error('Error checking mnemonic lockout:', error);
    return {
      is_locked: false,
      failed_attempts: 0,
      attempts_remaining: 3,
      locked_until: null,
      lockout_duration_hours: 24,
    };
  }
};

// Log mnemonic attempt and handle SMS notifications
const logMnemonicAttempt = async (
  customerId: string,
  success: boolean,
  failureReason?: string
): Promise<{
  is_blocked: boolean;
  failed_attempts: number;
  attempts_remaining: number;
  locked_until: string | null;
  lockout_duration_hours: number;
}> => {
  try {
    const deviceInfo = getDeviceInfo();
    const response = await fetch('http://localhost:8000/api/v1/restore/log-mnemonic-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        success,
        failureReason,
        deviceInfo: {
          ip_address: deviceInfo.ip_address,
          user_agent: deviceInfo.user_agent,
          device_info: deviceInfo.device_info,
          location: deviceInfo.location,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to log mnemonic attempt');
    }

    const data = await response.json();
    return {
      is_blocked: data.is_blocked,
      failed_attempts: data.failed_attempts,
      attempts_remaining: data.attempts_remaining,
      locked_until: data.locked_until,
      lockout_duration_hours: data.lockout_duration_hours,
    };
  } catch (error) {
    console.error('Error logging mnemonic attempt:', error);
    return {
      is_blocked: false,
      failed_attempts: 0,
      attempts_remaining: 3,
      locked_until: null,
      lockout_duration_hours: 24,
    };
  }
};

// Utility to get device information
const getDeviceInfo = (): {
  user_agent: string;
  ip_address: string;
  device_info: string;
  location: string;
} => {
  const userAgent = navigator.userAgent || 'Unknown';
  let deviceInfo = 'Unknown Device';
  if (/Chrome/.test(userAgent)) deviceInfo = 'Chrome Browser';
  else if (/Firefox/.test(userAgent)) deviceInfo = 'Firefox Browser';
  else if (/Safari/.test(userAgent)) deviceInfo = 'Safari Browser';
  else if (/Edge/.test(userAgent)) deviceInfo = 'Edge Browser';

  return {
    user_agent: userAgent,
    ip_address: 'Unknown',
    device_info: deviceInfo,
    location: 'Unknown',
  };
};