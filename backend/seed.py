"""
Seed data generator for RescueLink demo.
Generates realistic flood disaster scenario emergencies with 21-byte packets.
"""

import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from iece.packet import encode_packet, EmergencyType, SeverityLevel
from iece.grouping import SOSGrouper
from iece.priority import PrioritySOSQueue
from models import SOSReportModel, ClusterGroupModel


# Chennai Cooum/Adyar flood basin coordinates
SAMPLE_REPORTS_SPEC = [
    # Cluster: 3 reports in submerged housing colony (within 40 meters) -> Auto-grouped!
    {
        "victim_id": 9001,
        "lat": 13.082680,
        "lon": 80.270718,
        "type": EmergencyType.TRAPPED_FLOOD,
        "sev": SeverityLevel.P2,
        "people": 3,
        "gps_age": 12,
        "ts_offset": -600,
    },
    {
        "victim_id": 9002,
        "lat": 13.082850,
        "lon": 80.270820,
        "type": EmergencyType.TRAPPED_FLOOD,
        "sev": SeverityLevel.P2,
        "people": 2,
        "gps_age": 25,
        "ts_offset": -480,
    },
    {
        "victim_id": 9003,
        "lat": 13.082550,
        "lon": 80.270650,
        "type": EmergencyType.TRAPPED_FLOOD,
        "sev": SeverityLevel.P2,
        "people": 2,
        "gps_age": 5,
        "ts_offset": -320,
    },
    # P1 Life-threatening: Critical Cardiac Emergency
    {
        "victim_id": 9010,
        "lat": 13.089500,
        "lon": 80.278000,
        "type": EmergencyType.HEART_ATTACK,
        "sev": SeverityLevel.P1,
        "people": 1,
        "gps_age": 2,
        "ts_offset": -180,
    },
    # P2 Urgent: Trauma / Injured
    {
        "victim_id": 9020,
        "lat": 13.076000,
        "lon": 80.261000,
        "type": EmergencyType.INJURED,
        "sev": SeverityLevel.P2,
        "people": 2,
        "gps_age": 45,
        "ts_offset": -240,
    },
    # P3 Needs help: Stranded on rooftop
    {
        "victim_id": 9030,
        "lat": 13.095000,
        "lon": 80.282000,
        "type": EmergencyType.STRANDED,
        "sev": SeverityLevel.P3,
        "people": 4,
        "gps_age": 80,
        "ts_offset": -700,
    },
]


def seed_database(db: Session, grouper: SOSGrouper, queue: PrioritySOSQueue) -> List[Dict[str, Any]]:
    """Seed the database with sample emergency SOS reports."""
    now = int(time.time())
    seeded_records = []

    for spec in SAMPLE_REPORTS_SPEC:
        ts = now + spec["ts_offset"]
        raw = encode_packet(
            victim_id=spec["victim_id"],
            latitude=spec["lat"],
            longitude=spec["lon"],
            emergency_type=spec["type"],
            people_count=spec["people"],
            gps_age_sec=spec["gps_age"],
            timestamp=ts,
            severity=spec["sev"],
            is_simulated=True,
        )
        packet_id = f"SOS-{spec['victim_id']}-{ts}"
        raw_hex = raw.hex().upper()

        report_dict = {
            "packet_id": packet_id,
            "victim_id": spec["victim_id"],
            "latitude": spec["lat"],
            "longitude": spec["lon"],
            "emergency_type": int(spec["type"]),
            "emergency_type_label": EmergencyType.label(spec["type"]),
            "severity": int(spec["sev"]),
            "severity_label": SeverityLevel.label(spec["sev"]),
            "people_count": spec["people"],
            "gps_age_sec": spec["gps_age"],
            "timestamp": ts,
            "raw_hex": raw_hex,
            "flags": 1,
            "is_simulated": True,
            "status": "pending",
            "created_at": ts,
        }

        # Cluster via IECE Grouper
        cluster = grouper.process_report(report_dict)
        report_dict["group_id"] = cluster.group_id

        # Insert in DB
        db.merge(SOSReportModel(**report_dict))

        # Add to Priority Queue
        from iece.packet import decode_packet
        pkt_obj = decode_packet(raw)
        queue.push(
            packet=pkt_obj,
            raw_hex=raw_hex,
            status="pending",
            group_id=cluster.group_id,
            packet_id=packet_id,
        )

        seeded_records.append(report_dict)

    # Now write the distinct clusters to the database using merge
    for cluster in grouper.groups.values():
        grp_db = ClusterGroupModel(
            group_id=cluster.group_id,
            emergency_type=int(cluster.emergency_type),
            emergency_type_label=EmergencyType.label(cluster.emergency_type),
            severity=int(cluster.severity),
            severity_label=SeverityLevel.label(cluster.severity),
            centroid_lat=cluster.centroid_lat,
            centroid_lon=cluster.centroid_lon,
            total_people=cluster.total_people,
            status=cluster.status,
            created_at=cluster.created_at,
            updated_at=cluster.updated_at,
        )
        db.merge(grp_db)

    db.commit()
    return seeded_records
