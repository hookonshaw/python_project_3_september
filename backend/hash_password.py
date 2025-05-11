import hashlib
import os
    

def hash_password(password: str) -> bytes:
    iterations = 919
    current_hash = password.encode('utf-8')
    for _ in range(iterations):
        current_hash = hashlib.sha256(current_hash).digest()
    return current_hash.hex()


def verify_password(stored_hash: bytes, password: str) -> bool:
    test_hash = hash_password(password)
    return test_hash == stored_hash
