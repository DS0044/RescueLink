
"""
IECE - Intelligent Emergency Communication Engine
Compact packet encoding/decoding, priority queue scheduling, duplicate grouping, and cryptographic acknowledgement verification.
"""

from .packet import (
    EmergencyType,
    SeverityLevel,
    EmergencyPacket,
    encode_packet,
    decode_packet,
    explain_packet_bytes,
)
from .priority import PrioritySOSQueue, SOSPriorityItem
from .grouping import SOSGrouper, SOSClusterGroup
from .crypto import (
    ResponderKeyPair,
    create_signed_ack,
    verify_ack_signature,
    tamper_ack_payload,
)

__all__ = [
    "EmergencyType",
    "SeverityLevel",
    "EmergencyPacket",
    "encode_packet",
    "decode_packet",
    "explain_packet_bytes",
    "PrioritySOSQueue",
    "SOSPriorityItem",
    "SOSGrouper",
    "SOSClusterGroup",
    "ResponderKeyPair",
    "create_signed_ack",
    "verify_ack_signature",
    "tamper_ack_payload",
]
