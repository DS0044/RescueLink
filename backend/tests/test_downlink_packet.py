"""
Unit Tests for Downlink Packet Encoding, Ed25519 Signatures, Haversine ETA, and Mission State Machine.
"""

import sys
import os
import math

# Add backend and backend/iece to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "iece")))

from iece.packet import (
    DOWNLINK_SIZE,
    TeamType,
    DownlinkPacket,
    encode_downlink_packet,
    decode_downlink_packet,
    explain_downlink_packet_bytes,
    haversine_distance_km,
    calculate_suggested_eta,
)
from iece.crypto import (
    ResponderKeyPair,
    create_signed_downlink_message,
    verify_downlink_message,
    tamper_downlink_message,
    DEFAULT_RESPONDERS,
)
from iece.state_machine import (
    StatusCode,
    STATUS_TO_CODE,
    CODE_TO_STATUS,
    VALID_TRANSITIONS,
    validate_status_transition,
    NOTE_PRESETS,
    get_note_text,
)


def test_downlink_encode_decode_roundtrip():
    """Verify downlink packet encodes to exactly 16 bytes and decodes perfectly."""
    victim_id = 918237
    status_code = StatusCode.EN_ROUTE
    eta_min = 14
    team_type = TeamType.BOAT
    resp_num = 1
    note_code = 4  # "Stay on roof / elevated structure"
    ts = 1700000000

    raw = encode_downlink_packet(
        victim_id=victim_id,
        status_code=status_code,
        eta_minutes=eta_min,
        team_type=team_type,
        responder_id_num=resp_num,
        note_code=note_code,
        timestamp=ts,
        is_simulated=True,
    )

    assert len(raw) == 16, f"Downlink payload must be exactly 16 bytes, got {len(raw)}"
    assert len(raw) == DOWNLINK_SIZE

    pkt = decode_downlink_packet(raw)
    assert pkt.victim_id == victim_id
    assert pkt.status_code == status_code
    assert pkt.eta_minutes == eta_min
    assert pkt.team_type == team_type
    assert pkt.responder_id_num == resp_num
    assert pkt.note_code == note_code
    assert pkt.timestamp == ts
    assert pkt.flags & 0x01 == 1  # is_simulated
    print("✓ Downlink packet 16-byte encode/decode roundtrip passed")


def test_downlink_ed25519_signature():
    """Verify Ed25519 signing over the 16-byte payload produces valid 80-byte frame."""
    kp = ResponderKeyPair()
    raw = encode_downlink_packet(
        victim_id=5555,
        status_code=StatusCode.ACCEPTED,
        eta_minutes=8,
        team_type=TeamType.HELICOPTER,
        responder_id_num=2,
        note_code=1,
    )

    signed_msg = create_signed_downlink_message(raw, kp)
    assert signed_msg["payload_bytes_len"] == 16
    assert signed_msg["total_bytes_len"] == 80
    assert len(bytes.fromhex(signed_msg["signature_hex"])) == 64
    assert len(bytes.fromhex(signed_msg["public_key_hex"])) == 32

    # Verification passes
    is_valid, msg = verify_downlink_message(
        payload_bytes_or_hex=signed_msg["payload_hex"],
        signature_hex=signed_msg["signature_hex"],
        public_key_hex=signed_msg["public_key_hex"],
    )
    assert is_valid is True, f"Verification failed: {msg}"
    print("✓ Ed25519 downlink signing & verification passed")


def test_downlink_tamper_rejection():
    """Verify that tampering payload bytes or signature bits results in immediate cryptographic rejection."""
    kp = ResponderKeyPair()
    raw = encode_downlink_packet(
        victim_id=1234,
        status_code=StatusCode.EN_ROUTE,
        eta_minutes=15,
        team_type=TeamType.AMBULANCE,
        responder_id_num=1,
    )
    signed_msg = create_signed_downlink_message(raw, kp)

    # 1. Tamper signature
    tampered_sig = tamper_downlink_message(signed_msg, tamper_type="corrupt_signature")
    is_valid, err = verify_downlink_message(
        payload_bytes_or_hex=tampered_sig["payload_hex"],
        signature_hex=tampered_sig["signature_hex"],
        public_key_hex=tampered_sig["public_key_hex"],
        is_tampered=tampered_sig["is_tampered"],
        tamper_reason=tampered_sig["tamper_reason"],
    )
    assert is_valid is False
    assert "REJECTED" in err

    # 2. Tamper status byte in payload
    tampered_payload = tamper_downlink_message(signed_msg, tamper_type="modify_status")
    is_valid2, err2 = verify_downlink_message(
        payload_bytes_or_hex=tampered_payload["payload_hex"],
        signature_hex=tampered_payload["signature_hex"],
        public_key_hex=tampered_payload["public_key_hex"],
        is_tampered=tampered_payload["is_tampered"],
        tamper_reason=tampered_payload["tamper_reason"],
    )
    assert is_valid2 is False
    print("✓ Cryptographic tamper rejection verified")


def test_state_machine_transitions():
    """Verify that only valid mission state transitions are accepted and invalid jumps are rejected."""
    # Valid transitions
    v1, _ = validate_status_transition("pending", "accepted")
    assert v1 is True
    v2, _ = validate_status_transition("accepted", "en_route")
    assert v2 is True
    v3, _ = validate_status_transition("en_route", "arriving_soon")
    assert v3 is True
    v4, _ = validate_status_transition("arriving_soon", "arrived")
    assert v4 is True
    v5, _ = validate_status_transition("arrived", "closed")
    assert v5 is True

    # Invalid transitions (must be rejected)
    inv1, err1 = validate_status_transition("pending", "arrived")
    assert inv1 is False
    assert "Invalid transition" in err1

    inv2, err2 = validate_status_transition("pending", "en_route")
    assert inv2 is False
    assert "Invalid transition" in err2

    inv3, err3 = validate_status_transition("closed", "en_route")
    assert inv3 is False

    print("✓ Mission state machine transition rules verified")


def test_haversine_distance_and_eta():
    """Verify Haversine Great Circle distance matches known geospatial distances and speeds."""
    # Known points in Hyderabad / Chennai disaster zone
    # Distance from Base (17.3850, 78.4867) to Point B (17.4350, 78.5367) is ~7.6 km
    d = haversine_distance_km(17.3850, 78.4867, 17.4350, 78.5367)
    assert 7.0 < d < 8.0, f"Expected ~7.6 km, got {d}"

    # Check Boat speed: 20 km/h -> 7.6 / 20 * 60 = 22.8 min + 2 min buffer = ~25 min
    eta_boat = calculate_suggested_eta(17.4350, 78.5367, team_type=TeamType.BOAT, base_lat=17.3850, base_lon=78.4867)
    assert 23 <= eta_boat["suggested_eta_minutes"] <= 26

    # Check Helicopter speed: 150 km/h -> 7.6 / 150 * 60 = 3.04 min + 2 min buffer = ~5 min
    eta_heli = calculate_suggested_eta(17.4350, 78.5367, team_type=TeamType.HELICOPTER, base_lat=17.3850, base_lon=78.4867)
    assert 4 <= eta_heli["suggested_eta_minutes"] <= 6

    # Check Foot speed: 5 km/h -> 7.6 / 5 * 60 = 91.2 min + 2 min buffer = ~93 min
    eta_foot = calculate_suggested_eta(17.4350, 78.5367, team_type=TeamType.FOOT_TEAM, base_lat=17.3850, base_lon=78.4867)
    assert 90 <= eta_foot["suggested_eta_minutes"] <= 95

    print("✓ Haversine distance and team deployment speeds verified")


def test_downlink_packet_breakdown():
    """Verify human-readable byte breakdown generator for UI display."""
    raw = encode_downlink_packet(
        victim_id=8888,
        status_code=StatusCode.ARRIVING_SOON,
        eta_minutes=4,
        team_type=TeamType.FIRE_RESCUE,
        responder_id_num=1,
        note_code=3,
    )
    breakdown = explain_downlink_packet_bytes(raw)
    assert len(breakdown) == 8
    assert breakdown[0]["field"] == "Version & Flags"
    assert breakdown[2]["field"] == "Mission Status Code"
    assert "Arriving Soon" in breakdown[2]["description"]
    assert breakdown[3]["field"] == "Estimated Arrival (ETA)"
    assert breakdown[4]["field"] == "Dispatched Team Type"
    assert "Fire & Technical" in breakdown[4]["description"]
    print("✓ Downlink packet breakdown generator verified")


if __name__ == "__main__":
    test_downlink_encode_decode_roundtrip()
    test_downlink_ed25519_signature()
    test_downlink_tamper_rejection()
    test_state_machine_transitions()
    test_haversine_distance_and_eta()
    test_downlink_packet_breakdown()
    print("\nALL DOWNLINK TESTS PASSED! (6/6)")
