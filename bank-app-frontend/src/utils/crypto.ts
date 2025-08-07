import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import * as secp from '@noble/secp256k1';
import { sha256 } from 'js-sha256';

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

// Convert ArrayBuffer to base64 (equivalent to Buffer.toString('base64'))
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer (equivalent to Buffer.from(base64, 'base64'))
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert base64url to ArrayBuffer (already present in FidoLogin.tsx)
export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToArrayBuffer(base64);
}

// Convert ArrayBuffer to base64url (already present in FidoLogin.tsx)
export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export const deriveKeys = (mnemonic: string) => {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid seed phrase');

  const seed = mnemonicToSeedSync(mnemonic);
  const userId = sha256(seed);

  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/0'/0'/0/0`);
  if (!child.privateKey) throw new Error('Derivation failed');

  const publicKey = secp.getPublicKey(child.privateKey, true);

  return {
    userId,
    privateKey: toHex(child.privateKey),
    publicKey: toHex(publicKey),
  };
};

export const verifySeedPhrase = (mnemonic: string, storedUserId: string, storedPublicKey: string) => {
  try {
    const { userId, publicKey } = deriveKeys(mnemonic);
    return userId === storedUserId && publicKey === storedPublicKey;
  } catch {
    return false;
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