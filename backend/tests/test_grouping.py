"""Unit tests for IECE duplicate grouping and clustering."""

from iece.packet import EmergencyType, SeverityLevel
from iece.grouping import SOSGrouper, haversine_distance_meters


def test_haversine_distance():
    # Distance between Bangalore MG Road (12.9754, 77.6074) and Brigade Road (12.9738, 77.6076)
    dist = haversine_distance_meters(12.9754, 77.6074, 12.9738, 77.6076)
    # Approx 170-190 meters
    assert 150 < dist < 210


def test_duplicate_grouping_within_50m():
    grouper = SOSGrouper(default_radius_meters=50.0, default_time_window_sec=3600)

    # Base report: Trapped in Flood, 2 people
    rep1 = {
        "packet_id": "SOS-1",
        "victim_id": 1001,
        "latitude": 12.971600,
        "longitude": 77.594600,
        "emergency_type": int(EmergencyType.TRAPPED_FLOOD),
        "severity": int(SeverityLevel.P2),
        "people_count": 2,
        "timestamp": 1732200000,
    }
    # Second report: Trapped in Flood, 20m away, 3 people
    rep2 = {
        "packet_id": "SOS-2",
        "victim_id": 1002,
        "latitude": 12.971750,  # ~16 meters north
        "longitude": 77.594600,
        "emergency_type": int(EmergencyType.TRAPPED_FLOOD),
        "severity": int(SeverityLevel.P2),
        "people_count": 3,
        "timestamp": 1732200100,
    }

    g1 = grouper.process_report(rep1)
    g2 = grouper.process_report(rep2)

    # Should be merged into the exact same group
    assert g1.group_id == g2.group_id
    assert len(grouper.groups) == 1
    group = grouper.get_group(g1.group_id)
    assert group is not None
    assert group.total_people == 5  # 2 + 3 people
    assert len(group.reports) == 2  # individual records retained!
    assert "5 people need assistance here" in group.to_dict()["summary_card"]


def test_separate_groups_for_different_emergency_type():
    grouper = SOSGrouper(default_radius_meters=50.0)

    # Same location, but one is Heart Attack, one is Trapped in Flood
    rep1 = {
        "packet_id": "SOS-10",
        "victim_id": 2001,
        "latitude": 12.971600,
        "longitude": 77.594600,
        "emergency_type": int(EmergencyType.HEART_ATTACK),
        "severity": int(SeverityLevel.P1),
        "people_count": 1,
        "timestamp": 1732200000,
    }
    rep2 = {
        "packet_id": "SOS-11",
        "victim_id": 2002,
        "latitude": 12.971610,
        "longitude": 77.594600,
        "emergency_type": int(EmergencyType.TRAPPED_FLOOD),
        "severity": int(SeverityLevel.P2),
        "people_count": 2,
        "timestamp": 1732200010,
    }

    g1 = grouper.process_report(rep1)
    g2 = grouper.process_report(rep2)

    # Different emergency types must NEVER be lumped together
    assert g1.group_id != g2.group_id
    assert len(grouper.groups) == 2


def test_five_nearby_sos_reports_grouping():
    grouper = SOSGrouper(default_radius_meters=100.0)
    base_lat = 13.0827
    base_lon = 80.2707

    # Generate 5 reports in flood zone within 40m radius
    offsets = [
        (0.00000, 0.00000, 1),
        (0.00015, 0.00010, 2),
        (-0.00010, 0.00012, 1),
        (0.00012, -0.00015, 3),
        (-0.00008, -0.00010, 1),
    ]

    for i, (dlat, dlon, count) in enumerate(offsets):
        rep = {
            "packet_id": f"SOS-CLUSTER-{i}",
            "victim_id": 3000 + i,
            "latitude": base_lat + dlat,
            "longitude": base_lon + dlon,
            "emergency_type": int(EmergencyType.TRAPPED_FLOOD),
            "severity": int(SeverityLevel.P2),
            "people_count": count,
            "timestamp": 1732200000 + i * 20,
        }
        grouper.process_report(rep)

    assert len(grouper.groups) == 1
    grp = list(grouper.groups.values())[0]
    assert len(grp.reports) == 5
    assert grp.total_people == 8  # 1 + 2 + 1 + 3 + 1
