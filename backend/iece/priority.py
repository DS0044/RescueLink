"""
IECE Priority Transmission & Scheduling Engine

Rules:
1. Higher severity processed first: P1 (Life-threatening) > P2 (Urgent) > P3 (Needs help) > P4 (Check-in).
2. FIFO within identical severity: Older reports (smaller timestamp) are processed ahead of newer ones.
3. Thread-safe ordering suitable for LoRa packet dispatch and rescue dashboard triage.
"""

import heapq
import threading
import time
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from .packet import EmergencyPacket, SeverityLevel, EmergencyType


@dataclass(order=True)
class SOSPriorityItem:
    # Tuple for heap ordering: (severity_int, timestamp, sequence_counter)
    sort_key: tuple[int, int, int] = field(init=False)
    packet: EmergencyPacket = field(compare=False)
    raw_hex: str = field(compare=False)
    received_at: float = field(compare=False, default_factory=time.time)
    packet_id: str = field(compare=False, default="")
    group_id: Optional[str] = field(compare=False, default=None)
    status: str = field(compare=False, default="received")  # received, queued, processing, accepted
    seq: int = field(compare=False, default=0)

    def __post_init__(self):
        # Numeric severity: P1 = 1, P2 = 2, P3 = 3, P4 = 4.
        # Ascending sort: 1 (P1) < 2 (P2) < 3 (P3) < 4 (P4).
        # Ascending timestamp: older timestamp < newer timestamp (oldest first).
        self.sort_key = (int(self.packet.severity), int(self.packet.timestamp), self.seq)
        if not self.packet_id:
            self.packet_id = f"SOS-{self.packet.victim_id}-{self.packet.timestamp}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "packet_id": self.packet_id,
            "victim_id": self.packet.victim_id,
            "latitude": self.packet.latitude,
            "longitude": self.packet.longitude,
            "emergency_type": int(self.packet.emergency_type),
            "emergency_type_label": EmergencyType.label(self.packet.emergency_type),
            "severity": int(self.packet.severity),
            "severity_label": SeverityLevel.label(self.packet.severity),
            "people_count": self.packet.people_count,
            "gps_age_sec": self.packet.gps_age_sec,
            "timestamp": self.packet.timestamp,
            "is_simulated": bool(self.packet.flags & 0x01),
            "raw_hex": self.raw_hex,
            "received_at": self.received_at,
            "status": self.status,
            "group_id": self.group_id,
        }


class PrioritySOSQueue:
    """Thread-safe priority queue for emergency packets."""

    def __init__(self):
        self._heap: List[SOSPriorityItem] = []
        self._counter = 0
        self._lock = threading.Lock()

    def push(
        self,
        packet: EmergencyPacket,
        raw_hex: str = "",
        status: str = "received",
        group_id: Optional[str] = None,
        packet_id: str = "",
    ) -> SOSPriorityItem:
        with self._lock:
            self._counter += 1
            if not raw_hex:
                from .packet import encode_packet
                raw_hex = encode_packet(
                    victim_id=packet.victim_id,
                    latitude=packet.latitude,
                    longitude=packet.longitude,
                    emergency_type=packet.emergency_type,
                    people_count=packet.people_count,
                    gps_age_sec=packet.gps_age_sec,
                    timestamp=packet.timestamp,
                    severity=packet.severity,
                    is_simulated=bool(packet.flags & 0x01),
                ).hex().upper()

            item = SOSPriorityItem(
                packet=packet,
                raw_hex=raw_hex,
                status=status,
                group_id=group_id,
                packet_id=packet_id,
                seq=self._counter,
            )
            heapq.heappush(self._heap, item)
            return item

    def pop(self) -> Optional[SOSPriorityItem]:
        with self._lock:
            if not self._heap:
                return None
            return heapq.heappop(self._heap)

    def peek(self) -> Optional[SOSPriorityItem]:
        with self._lock:
            if not self._heap:
                return None
            return self._heap[0]

    def list_sorted(self) -> List[SOSPriorityItem]:
        """Return all items sorted by priority order without removing them."""
        with self._lock:
            return sorted(self._heap)

    def to_list_dict(self) -> List[Dict[str, Any]]:
        return [item.to_dict() for item in self.list_sorted()]

    def __len__(self) -> int:
        with self._lock:
            return len(self._heap)

    def clear(self):
        with self._lock:
            self._heap.clear()
            self._counter = 0
