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


# ==============================================================================
# DOWNLINK ACKNOWLEDGEMENT & STATUS UPDATE PACKET (16 Bytes Payload)
# ==============================================================================

DOWNLINK_FORMAT = ">B I B H B H I B"
DOWNLINK_SIZE = struct.calcsize(DOWNLINK_FORMAT)
assert DOWNLINK_SIZE == 16, f"Downlink payload size must be 16 bytes, got {DOWNLINK_SIZE}"


class TeamType(IntEnum):
    BOAT = 1
    AMBULANCE = 2
    FIRE_RESCUE = 3
    HELICOPTER = 4
    FOOT_TEAM = 5

    @classmethod
    def label(cls, value: int) -> str:
        labels = {
            cls.BOAT: "Boat Rescue Team",
            cls.AMBULANCE: "Ambulance / Medical Unit",
            cls.FIRE_RESCUE: "Fire & Technical Rescue",
            cls.HELICOPTER: "Air Rescue (Helicopter)",
            cls.FOOT_TEAM: "Foot Patrol Team",
        }
        return labels.get(value, f"Rescue Unit #{value}")

    @classmethod
    def speed_kmh(cls, value: int) -> float:
        speeds = {
            cls.BOAT: 20.0,
            cls.AMBULANCE: 40.0,
            cls.FIRE_RESCUE: 35.0,
            cls.HELICOPTER: 150.0,
            cls.FOOT_TEAM: 5.0,
        }
        return speeds.get(value, 25.0)


import math

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance between two coordinates in kilometers using Haversine formula."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def calculate_suggested_eta(
    victim_lat: float,
    victim_lon: float,
    team_type: int = 1,
    base_lat: float = 17.3850,
    base_lon: float = 78.4867,
    prep_buffer_min: int = 2,
) -> Dict[str, Any]:
    """Calculate estimated arrival time based on Haversine distance and team deployment speed."""
    distance_km = haversine_distance_km(base_lat, base_lon, victim_lat, victim_lon)
    speed = TeamType.speed_kmh(team_type)
    travel_time_hours = distance_km / speed
    travel_time_minutes = travel_time_hours * 60.0
    suggested_eta = max(1, int(round(travel_time_minutes + prep_buffer_min)))
    return {
        "distance_km": round(distance_km, 2),
        "speed_kmh": speed,
        "prep_buffer_min": prep_buffer_min,
        "suggested_eta_minutes": suggested_eta,
        "base_lat": base_lat,
        "base_lon": base_lon,
        "team_type": team_type,
        "team_type_label": TeamType.label(team_type),
    }


@dataclass
class DownlinkPacket:
    version: int          # 1-15
    flags: int            # bit 0: is_simulated, bit 1: is_retry
    victim_id: int        # uint32
    status_code: int      # uint8 (1=pending, 2=accepted, 3=en_route, 4=arriving_soon, 5=arrived, 6=closed, 7=eta_updated, 8=cancelled)
    eta_minutes: int      # uint16 (0-65535)
    team_type: int        # uint8 (1-5)
    responder_id_num: int # uint16 (numeric responder ID / hash)
    timestamp: int        # uint32 (epoch seconds)
    note_code: int        # uint8 (0-255 preset note)

    def to_dict(self) -> Dict[str, Any]:
        from iece.state_machine import StatusCode, NOTE_PRESETS, CODE_TO_STATUS
        return {
            "version": self.version,
            "flags": self.flags,
            "is_simulated": bool(self.flags & 0x01),
            "is_retry": bool(self.flags & 0x02),
            "victim_id": self.victim_id,
            "status_code": self.status_code,
            "status": CODE_TO_STATUS.get(self.status_code, "unknown"),
            "status_label": StatusCode.label(self.status_code),
            "eta_minutes": self.eta_minutes,
            "team_type": self.team_type,
            "team_type_label": TeamType.label(self.team_type),
            "responder_id_num": self.responder_id_num,
            "timestamp": self.timestamp,
            "note_code": self.note_code,
            "note_text": NOTE_PRESETS.get(self.note_code, ""),
        }


def encode_downlink_packet(
    victim_id: int,
    status_code: int,
    eta_minutes: int = 15,
    team_type: int = 1,
    responder_id_num: int = 1,
    note_code: int = 0,
    timestamp: Optional[int] = None,
    version: int = 1,
    is_simulated: bool = True,
    is_retry: bool = False,
) -> bytes:
    """Encode mission status and ETA update into exactly 16 bytes for LoRa downlink."""
    if timestamp is None:
        timestamp = int(time.time())

    flags = (0x01 if is_simulated else 0x00) | (0x02 if is_retry else 0x00)
    version_flags = ((version & 0x0F) << 4) | (flags & 0x0F)

    clamped_victim_id = int(victim_id) & 0xFFFFFFFF
    clamped_status = int(status_code) & 0xFF
    clamped_eta = max(0, min(65535, int(eta_minutes)))
    clamped_team = max(1, min(255, int(team_type)))
    clamped_resp_num = int(responder_id_num) & 0xFFFF
    clamped_timestamp = int(timestamp) & 0xFFFFFFFF
    clamped_note = int(note_code) & 0xFF

    raw_bytes = struct.pack(
        DOWNLINK_FORMAT,
        version_flags,
        clamped_victim_id,
        clamped_status,
        clamped_eta,
        clamped_team,
        clamped_resp_num,
        clamped_timestamp,
        clamped_note,
    )
    assert len(raw_bytes) == DOWNLINK_SIZE, f"Downlink payload must be 16 bytes, got {len(raw_bytes)}"
    return raw_bytes


def decode_downlink_packet(data: bytes) -> DownlinkPacket:
    """Decode exactly 16 bytes into DownlinkPacket."""
    if len(data) != DOWNLINK_SIZE:
        raise ValueError(f"Downlink packet must be {DOWNLINK_SIZE} bytes, got {len(data)}")

    (
        version_flags,
        victim_id,
        status_code,
        eta_minutes,
        team_type,
        responder_id_num,
        timestamp,
        note_code,
    ) = struct.unpack(DOWNLINK_FORMAT, data)

    version = (version_flags >> 4) & 0x0F
    flags = version_flags & 0x0F

    return DownlinkPacket(
        version=version,
        flags=flags,
        victim_id=victim_id,
        status_code=status_code,
        eta_minutes=eta_minutes,
        team_type=team_type,
        responder_id_num=responder_id_num,
        timestamp=timestamp,
        note_code=note_code,
    )


def explain_downlink_packet_bytes(raw_bytes: bytes) -> List[Dict[str, Any]]:
    """Return human-readable byte-by-byte breakdown of the 16-byte downlink payload for UI."""
    if len(raw_bytes) != 16:
        raise ValueError(f"Downlink packet must be 16 bytes, got {len(raw_bytes)}")

    packet = decode_downlink_packet(raw_bytes)
    hex_str = raw_bytes.hex().upper()
    from iece.state_machine import StatusCode, NOTE_PRESETS

    return [
        {
            "offset": "0 (1B)",
            "bytes_hex": hex_str[0:2],
            "field": "Version & Flags",
            "type": "uint8",
            "raw_value": f"0x{raw_bytes[0]:02X}",
            "description": f"v{packet.version}, Flags: 0x{packet.flags:01X} ({'SIMULATED' if packet.flags & 0x01 else 'REAL LORA'}{', RETRY' if packet.flags & 0x02 else ''})",
        },
        {
            "offset": "1-4 (4B)",
            "bytes_hex": hex_str[2:10],
            "field": "Target Victim Device ID",
            "type": "uint32 BE",
            "raw_value": str(packet.victim_id),
            "description": f"Destination Victim Node #{packet.victim_id}",
        },
        {
            "offset": "5 (1B)",
            "bytes_hex": hex_str[10:12],
            "field": "Mission Status Code",
            "type": "uint8",
            "raw_value": f"0x{packet.status_code:02X} ({packet.status_code})",
            "description": f"Status: {StatusCode.label(packet.status_code)}",
        },
        {
            "offset": "6-7 (2B)",
            "bytes_hex": hex_str[12:16],
            "field": "Estimated Arrival (ETA)",
            "type": "uint16 BE",
            "raw_value": f"{packet.eta_minutes} min",
            "description": f"{packet.eta_minutes} minutes (estimated)",
        },
        {
            "offset": "8 (1B)",
            "bytes_hex": hex_str[16:18],
            "field": "Dispatched Team Type",
            "type": "uint8",
            "raw_value": str(packet.team_type),
            "description": TeamType.label(packet.team_type),
        },
        {
            "offset": "9-10 (2B)",
            "bytes_hex": hex_str[18:22],
            "field": "Responder Authority ID",
            "type": "uint16 BE",
            "raw_value": f"#{packet.responder_id_num}",
            "description": f"Authorized Responder Key ID #{packet.responder_id_num}",
        },
        {
            "offset": "11-14 (4B)",
            "bytes_hex": hex_str[22:30],
            "field": "Transmission Epoch",
            "type": "uint32 BE",
            "raw_value": str(packet.timestamp),
            "description": f"Sent at {time.strftime('%H:%M:%S UTC', time.gmtime(packet.timestamp))}",
        },
        {
            "offset": "15 (1B)",
            "bytes_hex": hex_str[30:32],
            "field": "Instruction Note Code",
            "type": "uint8",
            "raw_value": str(packet.note_code),
            "description": NOTE_PRESETS.get(packet.note_code, "None / Custom"),
        },
    ]

