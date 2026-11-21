"""Unit tests for IECE 21-byte compact packet encoding and decoding."""

import pytest
from iece.packet import (
    EmergencyType,
    SeverityLevel,
    EmergencyPacket,
    encode_packet,
    decode_packet,
    explain_packet_bytes,
    PACKET_SIZE,
)


def test_packet_size_is_exactly_21_bytes():
    raw = encode_packet(
        victim_id=101,
        latitude=12.971598,
        longitude=77.594562,
        emergency_type=EmergencyType.TRAPPED_FLOOD,
        people_count=3,
        gps_age_sec=14,
        timestamp=1732200000,
        severity=SeverityLevel.P2,
        is_simulated=True,
    )
    assert len(raw) == 21
    assert PACKET_SIZE == 21


def test_packet_round_trip():
    original_victim_id = 987654
    original_lat = 13.082680
    original_lon = 80.270718
    original_type = EmergencyType.HEART_ATTACK
    original_sev = SeverityLevel.P1
    original_people = 1
    original_gps_age = 5
    original_ts = 1732201234

    raw = encode_packet(
        victim_id=original_victim_id,
        latitude=original_lat,
        longitude=original_lon,
        emergency_type=original_type,
        people_count=original_people,
        gps_age_sec=original_gps_age,
        timestamp=original_ts,
        severity=original_sev,
        is_simulated=False,
    )

    decoded = decode_packet(raw)

    assert decoded.victim_id == original_victim_id
    assert pytest.approx(decoded.latitude, abs=1e-5) == original_lat
    assert pytest.approx(decoded.longitude, abs=1e-5) == original_lon
    assert decoded.emergency_type == original_type
    assert decoded.severity == original_sev
    assert decoded.people_count == original_people
    assert decoded.gps_age_sec == original_gps_age
    assert decoded.timestamp == original_ts
    assert (decoded.flags & 0x01) == 0  # not simulated


def test_microdegree_negative_coordinates():
    # Test Southern/Western hemisphere coordinates (e.g. Rio de Janeiro or Sydney)
    raw = encode_packet(
        victim_id=5555,
        latitude=-22.906847,
        longitude=-43.172896,
        emergency_type=EmergencyType.STRANDED,
        people_count=4,
        gps_age_sec=120,
        timestamp=1732200500,
    )
    decoded = decode_packet(raw)
    assert pytest.approx(decoded.latitude, abs=1e-5) == -22.906847
    assert pytest.approx(decoded.longitude, abs=1e-5) == -43.172896
    assert decoded.people_count == 4


def test_explain_packet_bytes():
    raw = encode_packet(
        victim_id=1234,
        latitude=28.613939,
        longitude=77.209021,
        emergency_type=EmergencyType.HEART_ATTACK,
        people_count=1,
        gps_age_sec=2,
        timestamp=1732200000,
    )
    breakdown = explain_packet_bytes(raw)
    assert len(breakdown) == 8  # 8 logical fields in struct
    field_names = [f["field"] for f in breakdown]
    assert "Version & Flags" in field_names
    assert "Victim Device ID" in field_names
    assert "Latitude" in field_names
    assert "Longitude" in field_names
    assert "Emergency & Severity" in field_names
    assert "GPS Fix Age" in field_names
    assert "People Count" in field_names
    assert "Timestamp" in field_names
