"""
RescueLink Mission State Machine & Status Codes
Formal state transition validation and definitions for emergency rescue operations.
"""

from enum import IntEnum
from typing import Dict, List, Optional, Tuple, Any

class MissionStatus(str):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    ARRIVING_SOON = "arriving_soon"
    ARRIVED = "arrived"
    CLOSED = "closed"
    ETA_UPDATED = "eta_updated"
    CANCELLED = "cancelled"


class StatusCode(IntEnum):
    PENDING = 1
    ACCEPTED = 2
    EN_ROUTE = 3
    ARRIVING_SOON = 4
    ARRIVED = 5
    CLOSED = 6
    ETA_UPDATED = 7
    CANCELLED = 8

    @classmethod
    def label(cls, code: int) -> str:
        labels = {
            cls.PENDING: "Pending Response",
            cls.ACCEPTED: "Accepted by Team",
            cls.EN_ROUTE: "Team En Route",
            cls.ARRIVING_SOON: "Arriving Soon (< 5 min)",
            cls.ARRIVED: "Team Arrived On Scene",
            cls.CLOSED: "Mission Closed",
            cls.ETA_UPDATED: "ETA Updated",
            cls.CANCELLED: "Mission Cancelled / Reassigned",
        }
        return labels.get(code, f"Status ({code})")


STATUS_TO_CODE: Dict[str, int] = {
    "pending": StatusCode.PENDING,
    "accepted": StatusCode.ACCEPTED,
    "en_route": StatusCode.EN_ROUTE,
    "arriving_soon": StatusCode.ARRIVING_SOON,
    "arrived": StatusCode.ARRIVED,
    "closed": StatusCode.CLOSED,
    "eta_updated": StatusCode.ETA_UPDATED,
    "cancelled": StatusCode.CANCELLED,
}

CODE_TO_STATUS: Dict[int, str] = {v: k for k, v in STATUS_TO_CODE.items()}


# Valid State Transitions
# Key: current status -> Allowed target statuses
VALID_TRANSITIONS: Dict[str, List[str]] = {
    "pending": ["accepted", "cancelled"],
    "accepted": ["en_route", "arriving_soon", "eta_updated", "cancelled"],
    "en_route": ["arriving_soon", "arrived", "eta_updated", "cancelled"],
    "arriving_soon": ["arrived", "eta_updated", "cancelled"],
    "arrived": ["closed", "cancelled"],
    "eta_updated": ["en_route", "arriving_soon", "arrived", "eta_updated", "cancelled"],
    "closed": [],
    "cancelled": ["pending", "accepted"],
}


def validate_status_transition(current_status: str, target_status: str) -> Tuple[bool, Optional[str]]:
    """
    Validates whether the transition from current_status to target_status is permitted.
    Returns (is_valid, error_message).
    """
    current = current_status.lower()
    target = target_status.lower()

    if target not in STATUS_TO_CODE:
        return False, f"Unknown target status '{target}'. Allowed: {list(STATUS_TO_CODE.keys())}"

    if current not in VALID_TRANSITIONS:
        return False, f"Unknown current status '{current}'"

    allowed = VALID_TRANSITIONS.get(current, [])
    if target not in allowed:
        return False, (
            f"Invalid transition from '{current}' to '{target}'. "
            f"Permitted next states: {allowed if allowed else 'None (Terminal state)'}"
        )

    return True, None


# Predefined Short Note Codes (1 Byte in compact radio downlink)
NOTE_PRESETS: Dict[int, str] = {
    0: "",
    1: "Stay where you are",
    2: "Move to higher ground",
    3: "Show a light or signal",
    4: "Stay on roof / elevated structure",
    5: "Conserve phone battery",
    6: "Help is right outside",
}

TEXT_TO_NOTE_CODE: Dict[str, int] = {v.lower(): k for k, v in NOTE_PRESETS.items() if k != 0}


def get_note_text(code: int, custom_note: Optional[str] = None) -> str:
    """Return human readable note string from code or custom note."""
    if custom_note and custom_note.strip():
        return custom_note.strip()[:40]
    return NOTE_PRESETS.get(code, "")
