# --- File: bank-app-frontend/behaviour_analysis/app/core/security.py ---
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys.datatypes import PublicKey
from Crypto.Hash import keccak

def verify_signature(public_key_hex: str, signature_hex: str, message: str) -> bool:
    """
    Verifies an EIP-191 compliant ECDSA signature. This is the definitive and
    correct way to verify signatures from frontend libraries like viem.

    Args:
        public_key_hex: The user's 65-byte public key in hex (without '0x').
        signature_hex: The compact signature in hex (without '0x').
        message: The original challenge string that was signed.

    Returns:
        True if the signature is valid, False otherwise.
    """
    try:
        # 1. Recover the address of the signer from the message and signature.
        #    This part uses eth-account and is correct.
        message_encoded = encode_defunct(text=message)
        recovered_address = Account.recover_message(message_encoded, signature="0x" + signature_hex)

        # 2. Derive the user's known address from their stored public key.
        #    This part now correctly implements the Ethereum address standard.
        public_key_bytes = bytes.fromhex(public_key_hex)
        
        # The public key for address generation is the raw 64 bytes (x and y).
        # We strip the '04' prefix.
        k = keccak.new(digest_bits=256)
        k.update(public_key_bytes[1:])
        
        # The address is the last 20 bytes of the Keccak-256 hash.
        known_address_bytes = k.digest()[-20:]
        known_address = "0x" + known_address_bytes.hex()
        
        # 3. Compare the two addresses. If they match, the signature is valid.
        return recovered_address.lower() == known_address.lower()

    except Exception as e:
        print(f"Signature verification failed: {e}")
        return False