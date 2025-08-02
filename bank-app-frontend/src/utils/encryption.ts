// In your frontend encryption.ts
export async function encrypt(plaintext: string): Promise<string> {
  try {
    // 1. Prepare the public key
    const pemContents = import.meta.env.VITE_PUBLIC_KEY
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
    
    // 2. Convert PEM to ArrayBuffer
    const binaryDer = atob(pemContents);
    const keyBuffer = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      keyBuffer[i] = binaryDer.charCodeAt(i);
    }
    
    // 3. Import key
    const publicKey = await crypto.subtle.importKey(
      "spki",
      keyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    // 4. Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      new TextEncoder().encode(plaintext)
    );

    // 5. Return base64 encoded ciphertext
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}