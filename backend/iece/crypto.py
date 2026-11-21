"""
IECE Cryptographic Acknowledgement & Verification Module (Ed25519)

Provides asymmetric cryptographic signatures for responder acknowledgements:
1. Responders sign the acceptance payload using an Ed25519 private key.
2. The signed acknowledgement contains the canonical payload, signature (hex), and public key (hex).
3. The victim terminal verifies the Ed25519 signature against the responder's public key before updating status.
4. Tamper demonstration utility alters the payload to show verification failure.
"""

import json
from typing import Dict, Any, Tuple
from cryptography.hazmat.primitives.asymmetric import ed25519


def canonical_payload_bytes(payload: Dict[str, Any]) -> bytes:
    """Format payload dictionary into canonical deterministic JSON bytes."""
    # Sorted keys, compact separators
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


class ResponderKeyPair:
    """Ed25519 Key Pair for an authorized emergency responder."""

    def __init__(self, private_key_hex: str = None):
        if private_key_hex:
            priv_bytes = bytes.fromhex(private_key_hex)
            self._private_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
        else:
            self._private_key = ed25519.Ed25519PrivateKey.generate()
        self._public_key = self._private_key.public_key()

    @property
    def private_key_hex(self) -> str:
        return self._private_key.private_bytes_raw().hex()

    @property
    def public_key_hex(self) -> str:
        return self._public_key.public_bytes_raw().hex()

    def sign(self, data: bytes) -> str:
        sig = self._private_key.sign(data)
        return sig.hex()


# Default authorized rescue responders with deterministic seed keys for demo
DEFAULT_RESPONDERS = {
    "RESP-NDRF-01": {
        "id": "RESP-NDRF-01",
        "name": "Capt. A. Sharma (NDRF 4th Battalion)",
        "role": "Flood Rescue Commander",
        "keypair": ResponderKeyPair("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    },
    "RESP-SDRF-02": {
        "id": "RESP-SDRF-02",
        "name": "Inspector M. Rao (SDRF Quick Response)",
        "role": "Medical & Evac Lead",
        "keypair": ResponderKeyPair("fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"),
    },
}


def create_signed_ack(
    sos_id: str,
    responder_id: str,
    responder_name: str,
    timestamp: int,
    keypair: ResponderKeyPair,
    eta_minutes: int = 15,
) -> Dict[str, Any]:
    """Create and digitally sign an acknowledgement using Ed25519."""
    payload = {
        "sos_id": sos_id,
        "responder_id": responder_id,
        "responder_name": responder_name,
        "timestamp": timestamp,
        "eta_minutes": eta_minutes,
        "status": "accepted",
    }
    data_bytes = canonical_payload_bytes(payload)
    signature_hex = keypair.sign(data_bytes)

    return {
        "algorithm": "Ed25519",
        "payload": payload,
        "signature_hex": signature_hex,
        "public_key_hex": keypair.public_key_hex,
        "canonical_bytes_len": len(data_bytes),
    }


def verify_ack_signature(signed_ack: Dict[str, Any]) -> Tuple[bool, str]:
    """Verify Ed25519 signature of an acknowledgement."""
    try:
        payload = signed_ack.get("payload")
        if not payload:
            return False, "Missing payload in signed acknowledgement"

        sig_hex = signed_ack.get("signature_hex", "")
        pub_hex = signed_ack.get("public_key_hex", "")

        if not sig_hex or not pub_hex:
            return False, "Missing signature or public key"

        sig_bytes = bytes.fromhex(sig_hex)
        pub_bytes = bytes.fromhex(pub_hex)
        data_bytes = canonical_payload_bytes(payload)

        pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        pub_key.verify(sig_bytes, data_bytes)
        return True, "Valid Ed25519 signature from authorized responder"
    except Exception as e:
        return False, f"Signature verification failed: {str(e)}"


def tamper_ack_payload(signed_ack: Dict[str, Any], tamper_type: str = "modify_field") -> Dict[str, Any]:
    """Return a deliberately corrupted copy of the signed ack for demo testing."""
    import copy
    tampered = copy.deepcopy(signed_ack)

    if tamper_type == "modify_field":
        # Alter the responder_id or eta without recalculating signature
        tampered["payload"]["responder_name"] = "UNAUTHORIZED_ACTOR (MALICIOUS SPOOF)"
        tampered["payload"]["responder_id"] = "RESP-FAKE-99"
        tampered["is_tampered"] = True
        tampered["tamper_reason"] = "Payload responder details modified post-signing"
    elif tamper_type == "corrupt_signature":
        # Flip bits in signature
        sig = tampered["signature_hex"]
        flipped = "00" + sig[2:] if not sig.startswith("00") else "ff" + sig[2:]
        tampered["signature_hex"] = flipped
        tampered["is_tampered"] = True
        tampered["tamper_reason"] = "Signature bytes altered in simulated channel transmission"
    else:
        # Alter sos_id
        tampered["payload"]["sos_id"] = "SOS-FORGED-9999"
        tampered["is_tampered"] = True
        tampered["tamper_reason"] = "Victim SOS target ID changed to hijack rescue allocation"

    return tampered
