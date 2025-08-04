import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import * as secp from '@noble/secp256k1';
import { sha256 } from 'js-sha256';

export const generateSeedPhrase = () => generateMnemonic(wordlist);

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