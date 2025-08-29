#!/usr/bin/env python3

import hashlib

def hash_pin(pin: str) -> str:
    """Hash PIN using SHA-256 with salt for security - exact copy from your service"""
    salt = "atm_pin_salt_"
    return hashlib.sha256(f"{salt}{pin}".encode()).hexdigest()

# Test the hash calculation
test_pin = "1234"
calculated_hash = hash_pin(test_pin)

print(f"PIN: {test_pin}")
print(f"Salt: atm_pin_salt_")
print(f"Combined string: atm_pin_salt_{test_pin}")
print(f"Calculated hash: {calculated_hash}")

# Your manually inserted hash
your_hash = "8d23cf6c86e834a7aa6eded54c26ce2bb2e74903538c61bdd5d2197997ab2f72"
print(f"Your database hash: {your_hash}")
print(f"Hashes match: {calculated_hash == your_hash}")

# Test a few other common PINs to verify the function
test_pins = ["1234", "5678", "0000", "1111"]
print("\nTesting multiple PINs:")
for pin in test_pins:
    hash_result = hash_pin(pin)
    print(f"PIN {pin} -> {hash_result}")