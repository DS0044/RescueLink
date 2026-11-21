"""Unit tests for IECE priority queue scheduling."""

from iece.packet import EmergencyPacket, EmergencyType, SeverityLevel
from iece.priority import PrioritySOSQueue


def make_test_packet(victim_id: int, emergency_type: EmergencyType, severity: SeverityLevel, timestamp: int) -> EmergencyPacket:
    return EmergencyPacket(
        version=1,
        flags=1,
        victim_id=victim_id,
        latitude=12.9716,
        longitude=77.5946,
        emergency_type=emergency_type,
        severity=severity,
        gps_age_sec=10,
        people_count=1,
        timestamp=timestamp,
    )


def test_priority_ordering_p1_before_p3():
    """Verify that P1 (heart attack) takes priority over P3 (stranded), even when stranded arrives first."""
    queue = PrioritySOSQueue()

    # Stranded arrives at t=1000
    pkt_stranded = make_test_packet(
        victim_id=1,
        emergency_type=EmergencyType.STRANDED,
        severity=SeverityLevel.P3,
        timestamp=1000,
    )
    # Heart attack arrives later at t=1010
    pkt_cardiac = make_test_packet(
        victim_id=2,
        emergency_type=EmergencyType.HEART_ATTACK,
        severity=SeverityLevel.P1,
        timestamp=1010,
    )

    # Queue stranded first, then heart attack
    queue.push(pkt_stranded)
    queue.push(pkt_cardiac)

    # First popped MUST be cardiac (P1)
    popped_first = queue.pop()
    assert popped_first is not None
    assert popped_first.packet.victim_id == 2
    assert popped_first.packet.severity == SeverityLevel.P1
    assert popped_first.packet.emergency_type == EmergencyType.HEART_ATTACK

    # Second popped is stranded (P3)
    popped_second = queue.pop()
    assert popped_second is not None
    assert popped_second.packet.victim_id == 1
    assert popped_second.packet.severity == SeverityLevel.P3


def test_fifo_within_same_severity():
    """Verify that reports with same severity are processed FIFO (oldest timestamp first)."""
    queue = PrioritySOSQueue()

    pkt_older = make_test_packet(
        victim_id=10,
        emergency_type=EmergencyType.TRAPPED_FLOOD,
        severity=SeverityLevel.P2,
        timestamp=1000,
    )
    pkt_newer = make_test_packet(
        victim_id=11,
        emergency_type=EmergencyType.INJURED,
        severity=SeverityLevel.P2,
        timestamp=1050,
    )

    # Push newer first, then older
    queue.push(pkt_newer)
    queue.push(pkt_older)

    # Oldest timestamp should pop first
    first = queue.pop()
    second = queue.pop()

    assert first.packet.victim_id == 10
    assert second.packet.victim_id == 11


def test_multi_tier_priority_sort():
    queue = PrioritySOSQueue()
    queue.push(make_test_packet(4, EmergencyType.CHECK_IN, SeverityLevel.P4, 200))
    queue.push(make_test_packet(2, EmergencyType.TRAPPED_FLOOD, SeverityLevel.P2, 150))
    queue.push(make_test_packet(1, EmergencyType.HEART_ATTACK, SeverityLevel.P1, 300))
    queue.push(make_test_packet(3, EmergencyType.STRANDED, SeverityLevel.P3, 100))

    sorted_list = queue.list_sorted()
    victim_order = [item.packet.victim_id for item in sorted_list]
    # Expected: P1 (id 1) -> P2 (id 2) -> P3 (id 3) -> P4 (id 4)
    assert victim_order == [1, 2, 3, 4]
