"""Unit tests for Ed25519 digital signature creation, verification, and tampering detection."""

from iece.crypto import (
    ResponderKeyPair,
    create_signed_ack,
    verify_ack_signature,
    tamper_ack_payload,
    DEFAULT_RESPONDERS,
)


def test_ed25519_sign_and_verify_valid():
    keypair = ResponderKeyPair()
    sos_id = "SOS-1001-1732200000"
    responder_id = "RESP-NDRF-01"
    responder_name = "Capt. A. Sharma (NDRF)"
    ts = 1732200050

    signed_ack = create_signed_ack(
        sos_id=sos_id,
        responder_id=responder_id,
        responder_name=responder_name,
        timestamp=ts,
        keypair=keypair,
        eta_minutes=12,
    )

    assert signed_ack["algorithm"] == "Ed25519"
    assert len(signed_ack["signature_hex"]) == 128  # 64 bytes = 128 hex chars
    assert len(signed_ack["public_key_hex"]) == 64   # 32 bytes = 64 hex chars

    is_valid, reason = verify_ack_signature(signed_ack)
    assert is_valid is True
    assert "Valid" in reason


def test_tampered_payload_rejected():
    keypair = DEFAULT_RESPONDERS["RESP-NDRF-01"]["keypair"]
    signed_ack = create_signed_ack(
        sos_id="SOS-FLOOD-88",
        responder_id="RESP-NDRF-01",
        responder_name="Capt. A. Sharma (NDRF)",
        timestamp=1732201000,
        keypair=keypair,
    )

    # 1. Modify field tamper
    tampered_field = tamper_ack_payload(signed_ack, tamper_type="modify_field")
    valid_1, reason_1 = verify_ack_signature(tampered_field)
    assert valid_1 is False
    assert "verification failed" in reason_1.lower()

    # 2. Corrupt signature tamper
    tampered_sig = tamper_ack_payload(signed_ack, tamper_type="corrupt_signature")
    valid_2, reason_2 = verify_ack_signature(tampered_sig)
    assert valid_2 is False

    # 3. Forged sos_id tamper
    tampered_sos = tamper_ack_payload(signed_ack, tamper_type="forged_sos")
    valid_3, reason_3 = verify_ack_signature(tampered_sos)
    assert valid_3 is False
