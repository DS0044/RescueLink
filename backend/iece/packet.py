"""
IECE Compact Packet Definition (21 Bytes)

Binary Layout (Big-Endian '>B I i i B H B I'):
  Byte 0       (1B): Version (upper 4 bits) & Flags (lower 4 bits, bit 0: simulated link)
  Bytes 1-4    (4B): Victim Device ID (uint32)
  Bytes 5-8    (4B): Latitude in microdegrees (int32, lat * 1e6)
  Bytes 9-12   (4B): Longitude in microdegrees (int32, lon * 1e6)
  Byte 13      (1B): Emergency Type (upper 4 bits) & Severity Level (lower 4 bits)
  Bytes 14-15  (2B): GPS Age in seconds (uint16, 0-65535)
  Byte 16      (1B): People count (uint8, 1-255)
  Bytes 17-20  (4B): Timestamp epoch seconds (uint32)

Total: 1 + 4 + 4 + 4 + 1 + 2 + 1 + 4 = 21 Bytes.
"""

import struct
import time
from enum import IntEnum
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

PACKET_FORMAT = ">B I i i B H B I"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)  # exactly 21 bytes
assert PACKET_SIZE == 21, f"Packet size must be 21 bytes, got {PACKET_SIZE}"


class EmergencyType(IntEnum):
    HEART_ATTACK = 1
    TRAPPED_FLOOD = 2
    INJURED = 3
    MEDICAL_NEED = 4
    STRANDED = 5
    CHECK_IN = 6

    @classmethod
    def label(cls, value: int) -> str:
        labels = {
            cls.HEART_ATTACK: "Heart Attack",
            cls.TRAPPED_FLOOD: "Trapped in Flood",
            cls.INJURED: "Injured",
            cls.MEDICAL_NEED: "Medical Need",
            cls.STRANDED: "Stranded (general)",
            cls.CHECK_IN: "Check-in",
        }
        return labels.get(value, f"Unknown ({value})")


class SeverityLevel(IntEnum):
    P1 = 1  # Life-threatening
    P2 = 2  # Urgent
    P3 = 3  # Needs help
    P4 = 4  # Check-in / Non-urgent

    @classmethod
    def label(cls, value: int) -> str:
        labels = {
            cls.P1: "P1 - Life Threatening",
            cls.P2: "P2 - Urgent",
            cls.P3: "P3 - Needs Help",
            cls.P4: "P4 - Check-in",
        }
        return labels.get(value, f"Unknown P{value}")


DEFAULT_SEVERITY_MAP = {
    EmergencyType.HEART_ATTACK: SeverityLevel.P1,
    EmergencyType.TRAPPED_FLOOD: SeverityLevel.P2,
    EmergencyType.INJURED: SeverityLevel.P2,
    EmergencyType.MEDICAL_NEED: SeverityLevel.P3,
    EmergencyType.STRANDED: SeverityLevel.P3,
    EmergencyType.CHECK_IN: SeverityLevel.P4,
}


@dataclass
class EmergencyPacket:
    version: int  # 1-15 (default 1)
    flags: int  # bit 0: is_simulated (0x01)
    victim_id: int  # uint32
    latitude: float  # float degrees (-90.0 to +90.0)
    longitude: float  # float degrees (-180.0 to +180.0)
    emergency_type: EmergencyType
    severity: SeverityLevel
    gps_age_sec: int  # uint16 (0 - 65535)
    people_count: int  # uint8 (1 - 255)
    timestamp: int  # uint32 (epoch seconds)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["emergency_type_label"] = EmergencyType.label(self.emergency_type)
        d["severity_label"] = SeverityLevel.label(self.severity)
        d["is_simulated"] = bool(self.flags & 0x01)
        return d


def encode_packet(
    victim_id: int,
    latitude: float,
    longitude: float,
    emergency_type: EmergencyType | int,
    people_count: int = 1,
    gps_age_sec: int = 0,
    timestamp: Optional[int] = None,
    severity: Optional[SeverityLevel | int] = None,
    version: int = 1,
    is_simulated: bool = True,
) -> bytes:
    """Encode emergency data into exactly 21 bytes."""
    em_type = EmergencyType(emergency_type)
    if severity is None:
        sev = DEFAULT_SEVERITY_MAP.get(em_type, SeverityLevel.P3)
    else:
        sev = SeverityLevel(severity)

    if timestamp is None:
        timestamp = int(time.time())

    # Flags: bit 0 is_simulated
    flags = 0x01 if is_simulated else 0x00
    version_flags = ((version & 0x0F) << 4) | (flags & 0x0F)

    # Convert coordinates to microdegrees (int32)
    lat_micro = int(round(latitude * 1_000_000))
    lon_micro = int(round(longitude * 1_000_000))

    type_sev = ((int(em_type) & 0x0F) << 4) | (int(sev) & 0x0F)

    clamped_gps_age = max(0, min(65535, int(gps_age_sec)))
    clamped_people = max(1, min(255, int(people_count)))
    clamped_victim_id = int(victim_id) & 0xFFFFFFFF
    clamped_timestamp = int(timestamp) & 0xFFFFFFFF

    raw_bytes = struct.pack(
        PACKET_FORMAT,
        version_flags,
        clamped_victim_id,
        lat_micro,
        lon_micro,
        type_sev,
        clamped_gps_age,
        clamped_people,
        clamped_timestamp,
    )
    assert len(raw_bytes) == PACKET_SIZE, f"Encoded {len(raw_bytes)} bytes instead of 21"
    return raw_bytes


def decode_packet(data: bytes) -> EmergencyPacket:
    """Decode exactly 21 bytes into an EmergencyPacket."""
    if len(data) != PACKET_SIZE:
        raise ValueError(f"Invalid packet length {len(data)}, expected {PACKET_SIZE} bytes")

    (
        version_flags,
        victim_id,
        lat_micro,
        lon_micro,
        type_sev,
        gps_age_sec,
        people_count,
        timestamp,
    ) = struct.unpack(PACKET_FORMAT, data)

    version = (version_flags >> 4) & 0x0F
    flags = version_flags & 0x0F
    em_type_int = (type_sev >> 4) & 0x0F
    severity_int = type_sev & 0x0F

    emergency_type = EmergencyType(em_type_int) if em_type_int in EmergencyType._value2member_map_ else EmergencyType.STRANDED
    severity = SeverityLevel(severity_int) if severity_int in SeverityLevel._value2member_map_ else SeverityLevel.P3

    lat = lat_micro / 1_000_000.0
    lon = lon_micro / 1_000_000.0

    return EmergencyPacket(
        version=version,
        flags=flags,
        victim_id=victim_id,
        latitude=lat,
        longitude=lon,
        emergency_type=emergency_type,
        severity=severity,
        gps_age_sec=gps_age_sec,
        people_count=people_count,
        timestamp=timestamp,
    )


def explain_packet_bytes(raw_bytes: bytes) -> List[Dict[str, Any]]:
    """Return human-readable byte-by-byte breakdown of the 21-byte packet for the UI."""
    if len(raw_bytes) != 21:
        raise ValueError(f"Packet must be 21 bytes, got {len(raw_bytes)}")

    packet = decode_packet(raw_bytes)
    hex_str = raw_bytes.hex().upper()

    breakdown = [
        {
            "offset": "0 (1B)",
            "bytes_hex": hex_str[0:2],
            "field": "Version & Flags",
            "type": "uint8",
            "raw_value": f"0x{raw_bytes[0]:02X}",
            "description": f"Protocol v{packet.version}, Flags: 0x{packet.flags:01X} ({'SIMULATED' if packet.flags & 0x01 else 'REAL LORA'})",
        },
        {
            "offset": "1-4 (4B)",
            "bytes_hex": hex_str[2:10],
            "field": "Victim Device ID",
            "type": "uint32 BE",
            "raw_value": str(packet.victim_id),
            "description": f"Unique Transmitter Node ID #{packet.victim_id}",
        },
        {
            "offset": "5-8 (4B)",
            "bytes_hex": hex_str[10:18],
            "field": "Latitude",
            "type": "int32 microdegrees",
            "raw_value": f"{int(round(packet.latitude * 1e6))} µdeg",
            "description": f"{packet.latitude:.6f}° N/S",
        },
        {
            "offset": "9-12 (4B)",
            "bytes_hex": hex_str[18:26],
            "field": "Longitude",
            "type": "int32 microdegrees",
            "raw_value": f"{int(round(packet.longitude * 1e6))} µdeg",
            "description": f"{packet.longitude:.6f}° E/W",
        },
        {
            "offset": "13 (1B)",
            "bytes_hex": hex_str[26:28],
            "field": "Emergency & Severity",
            "type": "uint8 (4b Type + 4b Sev)",
            "raw_value": f"0x{raw_bytes[13]:02X}",
            "description": f"Type: {EmergencyType.label(packet.emergency_type)} | Priority: {SeverityLevel.label(packet.severity)}",
        },
        {
            "offset": "14-15 (2B)",
            "bytes_hex": hex_str[28:32],
            "field": "GPS Fix Age",
            "type": "uint16 BE",
            "raw_value": f"{packet.gps_age_sec}s",
            "description": f"GPS Satellite Fix acquired {packet.gps_age_sec} seconds ago",
        },
        {
            "offset": "16 (1B)",
            "bytes_hex": hex_str[32:34],
            "field": "People Count",
            "type": "uint8",
            "raw_value": str(packet.people_count),
            "description": f"{packet.people_count} person(s) at site needing immediate extraction",
        },
        {
            "offset": "17-20 (4B)",
            "bytes_hex": hex_str[34:42],
            "field": "Timestamp",
            "type": "uint32 BE (epoch)",
            "raw_value": str(packet.timestamp),
            "description": f"Epoch: {packet.timestamp} ({time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(packet.timestamp))})",
        },
    ]
    return breakdown
