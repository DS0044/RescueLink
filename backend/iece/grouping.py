"""
IECE Duplicate Grouping Engine

Groups compatible SOS reports:
- Same emergency type
- Within configurable distance radius (default: 50.0 meters)
- Within configurable time window (default: 3600 seconds)
- Aggregate group card: e.g. "5 people need assistance here"
- Retains 100% of individual victim reports inside the cluster group.
"""

import math
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from .packet import EmergencyPacket, EmergencyType, SeverityLevel


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon points using Haversine formula."""
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@dataclass
class SOSClusterGroup:
    group_id: str
    emergency_type: EmergencyType
    severity: SeverityLevel
    centroid_lat: float
    centroid_lon: float
    total_people: int
    created_at: int
    updated_at: int
    radius_meters: float = 50.0
    status: str = "pending"  # pending, accepted, dispatched, resolved
    responder_id: Optional[str] = None
    responder_name: Optional[str] = None
    accepted_at: Optional[int] = None
    reports: List[Dict[str, Any]] = field(default_factory=list)

    def add_report(self, report_dict: Dict[str, Any]):
        self.reports.append(report_dict)
        # Recompute totals and centroid
        self.total_people = sum(r.get("people_count", 1) for r in self.reports)
        self.centroid_lat = sum(r["latitude"] for r in self.reports) / len(self.reports)
        self.centroid_lon = sum(r["longitude"] for r in self.reports) / len(self.reports)

        # Priority is the most severe (lowest numeric value) among members
        severities = [r.get("severity", 3) for r in self.reports]
        min_sev = min(severities)
        self.severity = SeverityLevel(min_sev)

        self.updated_at = max(self.updated_at, int(report_dict.get("timestamp", time.time())))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group_id": self.group_id,
            "emergency_type": int(self.emergency_type),
            "emergency_type_label": EmergencyType.label(self.emergency_type),
            "severity": int(self.severity),
            "severity_label": SeverityLevel.label(self.severity),
            "centroid_lat": round(self.centroid_lat, 6),
            "centroid_lon": round(self.centroid_lon, 6),
            "total_people": self.total_people,
            "report_count": len(self.reports),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "radius_meters": self.radius_meters,
            "status": self.status,
            "responder_id": self.responder_id,
            "responder_name": self.responder_name,
            "accepted_at": self.accepted_at,
            "summary_card": f"{self.total_people} {'person' if self.total_people == 1 else 'people'} need assistance here ({len(self.reports)} reports)",
            "reports": self.reports,
        }


class SOSGrouper:
    """Manages active clusters and groups compatible incoming reports."""

    def __init__(self, default_radius_meters: float = 50.0, default_time_window_sec: int = 3600):
        self.default_radius_meters = default_radius_meters
        self.default_time_window_sec = default_time_window_sec
        self.groups: Dict[str, SOSClusterGroup] = {}
        self._group_seq = 0

    def process_report(
        self,
        report_dict: Dict[str, Any],
        custom_radius: Optional[float] = None,
        custom_time_window: Optional[int] = None,
    ) -> SOSClusterGroup:
        """Find matching group within radius and time window, or create a new one."""
        radius = custom_radius or self.default_radius_meters
        time_window = custom_time_window or self.default_time_window_sec

        rep_lat = float(report_dict["latitude"])
        rep_lon = float(report_dict["longitude"])
        rep_type = EmergencyType(report_dict["emergency_type"])
        rep_ts = int(report_dict.get("timestamp", time.time()))

        best_group: Optional[SOSClusterGroup] = None
        min_dist = float("inf")

        for grp in self.groups.values():
            # Check compatibility: same emergency type
            if grp.emergency_type != rep_type:
                continue

            # Check time window
            if abs(rep_ts - grp.created_at) > time_window:
                continue

            dist = haversine_distance_meters(rep_lat, rep_lon, grp.centroid_lat, grp.centroid_lon)
            if dist <= radius and dist < min_dist:
                min_dist = dist
                best_group = grp

        if best_group is not None:
            report_dict["group_id"] = best_group.group_id
            best_group.add_report(report_dict)
            return best_group
        else:
            self._group_seq += 1
            group_id = f"GRP-{rep_type.name[:3]}-{self._group_seq:04d}"
            report_dict["group_id"] = group_id
            new_group = SOSClusterGroup(
                group_id=group_id,
                emergency_type=rep_type,
                severity=SeverityLevel(report_dict.get("severity", 3)),
                centroid_lat=rep_lat,
                centroid_lon=rep_lon,
                total_people=int(report_dict.get("people_count", 1)),
                created_at=rep_ts,
                updated_at=rep_ts,
                radius_meters=radius,
                reports=[report_dict],
            )
            self.groups[group_id] = new_group
            return new_group

    def get_group(self, group_id: str) -> Optional[SOSClusterGroup]:
        return self.groups.get(group_id)

    def list_groups(self) -> List[Dict[str, Any]]:
        # Sort by severity ascending (P1 first), then updated_at descending
        sorted_groups = sorted(
            self.groups.values(),
            key=lambda g: (int(g.severity), -g.updated_at),
        )
        return [g.to_dict() for g in sorted_groups]

    def clear(self):
        self.groups.clear()
        self._group_seq = 0
