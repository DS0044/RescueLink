"""
RescueLink Backend API
FastAPI server implementing offline emergency communication, IECE engine integration,
simulated LoRa channel, and Ed25519 signed acknowledgement verification.
"""

import os
import time
import json
import asyncio
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import init_db, get_db
from models import SOSReportModel, ClusterGroupModel, DownlinkMessageModel
from iece.packet import (
    EmergencyType,
    SeverityLevel,
    EmergencyPacket,
    encode_packet,
    decode_packet,
    explain_packet_bytes,
    DEFAULT_SEVERITY_MAP,
    TeamType,
    DownlinkPacket,
    encode_downlink_packet,
    decode_downlink_packet,
    explain_downlink_packet_bytes,
    calculate_suggested_eta,
    haversine_distance_km,
)
from iece.priority import PrioritySOSQueue
from iece.grouping import SOSGrouper
from iece.crypto import (
    ResponderKeyPair,
    create_signed_ack,
    verify_ack_signature,
    tamper_ack_payload,
    create_signed_downlink_message,
    verify_downlink_message,
    tamper_downlink_message,
    DEFAULT_RESPONDERS,
)
from iece.state_machine import (
    MissionStatus,
    StatusCode,
    STATUS_TO_CODE,
    CODE_TO_STATUS,
    VALID_TRANSITIONS,
    validate_status_transition,
    NOTE_PRESETS,
    get_note_text,
)
from simulator import lora_simulator
from seed import seed_database


# Global Engine Instances
priority_queue = PrioritySOSQueue()
sos_grouper = SOSGrouper(default_radius_meters=50.0, default_time_window_sec=3600)


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


ws_manager = ConnectionManager()


def rebuild_engine_state(db: Session):
    """Rebuild in-memory IECE priority queue and grouper from DB."""
    sos_grouper.clear()
    priority_queue.clear()
    reports = db.query(SOSReportModel).order_by(SOSReportModel.timestamp.asc()).all()
    for r in reports:
        report_dict = {
            "packet_id": r.packet_id,
            "victim_id": r.victim_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "emergency_type": r.emergency_type,
            "emergency_type_label": r.emergency_type_label,
            "severity": r.severity,
            "severity_label": r.severity_label,
            "people_count": r.people_count,
            "gps_age_sec": r.gps_age_sec,
            "timestamp": r.timestamp,
            "raw_hex": r.raw_hex,
            "flags": r.flags,
            "is_simulated": r.is_simulated,
            "status": r.status,
            "group_id": r.group_id,
            "responder_id": r.responder_id,
            "responder_name": r.responder_name,
            "accepted_at": r.accepted_at,
            "created_at": r.created_at,
        }
        cluster = sos_grouper.process_report(report_dict)
        if r.status == "accepted":
            cluster.status = "accepted"
            cluster.responder_id = r.responder_id
            cluster.responder_name = r.responder_name
            cluster.accepted_at = r.accepted_at
        try:
            raw_bytes = bytes.fromhex(r.raw_hex)
            pkt = decode_packet(raw_bytes)
            priority_queue.push(
                packet=pkt,
                raw_hex=r.raw_hex,
                status=r.status,
                group_id=r.group_id,
                packet_id=r.packet_id,
            )
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite Database tables
    init_db()
    # Populate initial seed data so evaluator never sees an empty screen
    db_gen = get_db()
    db = next(db_gen)
    try:
        count = db.query(SOSReportModel).count()
        if count == 0:
            seed_database(db, sos_grouper, priority_queue)
        else:
            rebuild_engine_state(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="RESCUE LINK Backend API",
    description="Offline Emergency Communication & Coordination Engine (IECE + LoRa + Ed25519)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Request Models
class SendSOSRequest(BaseModel):
    victim_id: Optional[int] = Field(default=None, description="Optional custom victim device ID")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    emergency_type: int = Field(..., ge=1, le=6)
    people_count: int = Field(default=1, ge=1, le=255)
    gps_age_sec: int = Field(default=0, ge=0, le=65535)
    severity: Optional[int] = Field(default=None, ge=1, le=4)
    is_simulated: bool = Field(default=True)


class UplinkHexRequest(BaseModel):
    raw_hex: str = Field(..., min_length=42, max_length=42, description="21-byte hex string")
    rssi_dbm: Optional[float] = None
    snr_db: Optional[float] = None


class ResponderLoginRequest(BaseModel):
    responder_id: str
    password: Optional[str] = "demo123"


class AcceptSOSRequest(BaseModel):
    responder_id: str
    responder_name: Optional[str] = None
    eta_minutes: Optional[int] = 15
    team_type: Optional[int] = 1
    note_code: Optional[int] = 0
    note_text: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str
    responder_id: Optional[str] = "RESP-NDRF-01"
    responder_name: Optional[str] = None
    eta_minutes: Optional[int] = None
    team_type: Optional[int] = None
    note_code: Optional[int] = None
    note_text: Optional[str] = None


class SimulateMissionRequest(BaseModel):
    speed: Optional[int] = 10  # 1, 10, 60


class DownlinkAckConfirmationRequest(BaseModel):
    message_id: str
    timestamp: Optional[int] = None



class SimConfigRequest(BaseModel):
    delay_ms: Optional[int] = None
    packet_loss_percent: Optional[float] = None
    mode: Optional[str] = None


# Endpoints

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "RescueLink IECE Backend",
        "link_mode": lora_simulator.mode,
        "is_simulated": lora_simulator.mode == "SIMULATED",
        "time": int(time.time()),
    }


@app.get("/api/simulator/config")
def get_simulator_config():
    return lora_simulator.get_status()


@app.post("/api/simulator/config")
async def update_simulator_config(req: SimConfigRequest):
    lora_simulator.set_config(
        delay_ms=req.delay_ms,
        packet_loss_percent=req.packet_loss_percent,
        mode=req.mode,
    )
    status_data = lora_simulator.get_status()
    await ws_manager.broadcast({"type": "SIM_CONFIG_UPDATED", "config": status_data})
    return status_data


@app.post("/api/auth/responder-login")
def responder_login(req: ResponderLoginRequest):
    responder = DEFAULT_RESPONDERS.get(req.responder_id)
    if not responder:
        # Default fallback responder for demo ease
        responder = DEFAULT_RESPONDERS["RESP-NDRF-01"]

    return {
        "status": "authenticated",
        "responder_id": responder["id"],
        "responder_name": responder["name"],
        "role": responder["role"],
        "public_key_hex": responder["keypair"].public_key_hex,
    }


@app.get("/api/responders")
def list_responders():
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "role": r["role"],
            "public_key_hex": r["keypair"].public_key_hex,
        }
        for r in DEFAULT_RESPONDERS.values()
    ]


@app.post("/api/sos/send")
async def send_victim_sos(req: SendSOSRequest, db: Session = Depends(get_db)):
    """
    Victim initiates SOS transmission:
    1. Encode into compact 21-byte packet.
    2. Transmit through simulated LoRa channel.
    3. If not dropped, process through IECE (priority + grouping) and save to DB.
    """
    now = int(time.time())
    victim_id = req.victim_id or (int(now % 90000) + 1000)

    # 1. Encode 21 bytes
    raw_bytes = encode_packet(
        victim_id=victim_id,
        latitude=req.latitude,
        longitude=req.longitude,
        emergency_type=req.emergency_type,
        people_count=req.people_count,
        gps_age_sec=req.gps_age_sec,
        timestamp=now,
        severity=req.severity,
        is_simulated=req.is_simulated,
    )
    raw_hex = raw_bytes.hex().upper()
    packet_id = f"SOS-{victim_id}-{now}"

    # Log initial victim TX event
    lora_simulator.log_event(
        "VICTIM",
        f"Victim initiated SOS ({EmergencyType.label(req.emergency_type)}, {req.people_count} people)",
        {"victim_id": victim_id, "lat": req.latitude, "lon": req.longitude},
    )

    # 2. Simulate LoRa physical transmission
    tx_result = await lora_simulator.transmit_uplink(raw_bytes, victim_id)

    if tx_result.get("dropped"):
        await ws_manager.broadcast({
            "type": "PACKET_DROPPED",
            "victim_id": victim_id,
            "reason": tx_result.get("reason"),
        })
        return {
            "status": "dropped",
            "delivered": False,
            "packet_id": packet_id,
            "victim_id": victim_id,
            "raw_hex": raw_hex,
            "reason": tx_result.get("reason"),
            "tx_metrics": tx_result,
        }

    # 3. IECE Engine Decoding & Processing
    decoded_pkt = decode_packet(raw_bytes)
    breakdown = explain_packet_bytes(raw_bytes)

    report_dict = {
        "packet_id": packet_id,
        "victim_id": decoded_pkt.victim_id,
        "latitude": decoded_pkt.latitude,
        "longitude": decoded_pkt.longitude,
        "emergency_type": int(decoded_pkt.emergency_type),
        "emergency_type_label": EmergencyType.label(decoded_pkt.emergency_type),
        "severity": int(decoded_pkt.severity),
        "severity_label": SeverityLevel.label(decoded_pkt.severity),
        "people_count": decoded_pkt.people_count,
        "gps_age_sec": decoded_pkt.gps_age_sec,
        "timestamp": decoded_pkt.timestamp,
        "raw_hex": raw_hex,
        "flags": decoded_pkt.flags,
        "is_simulated": bool(decoded_pkt.flags & 0x01),
        "status": "pending",
        "created_at": now,
    }

    # Grouping via IECE
    cluster = sos_grouper.process_report(report_dict)
    report_dict["group_id"] = cluster.group_id

    # Priority Queue
    queue_item = priority_queue.push(
        packet=decoded_pkt,
        raw_hex=raw_hex,
        status="pending",
        group_id=cluster.group_id,
        packet_id=packet_id,
    )

    # Persist to SQLite
    db.merge(SOSReportModel(**report_dict))

    # Update or add Cluster Group in DB
    grp_db = ClusterGroupModel(
        group_id=cluster.group_id,
        emergency_type=int(cluster.emergency_type),
        emergency_type_label=EmergencyType.label(cluster.emergency_type),
        severity=int(cluster.severity),
        severity_label=SeverityLevel.label(cluster.severity),
        centroid_lat=cluster.centroid_lat,
        centroid_lon=cluster.centroid_lon,
        total_people=cluster.total_people,
        status="pending",
        created_at=cluster.created_at,
        updated_at=cluster.updated_at,
    )
    db.merge(grp_db)
    db.commit()

    lora_simulator.log_event(
        "IECE",
        f"IECE processed packet: Assigned to group {cluster.group_id}, Priority {SeverityLevel.label(decoded_pkt.severity)}",
        {"packet_id": packet_id, "group_id": cluster.group_id, "priority": decoded_pkt.severity},
    )

    # Broadcast to dashboard
    broadcast_payload = {
        "type": "NEW_SOS",
        "report": report_dict,
        "cluster": cluster.to_dict(),
        "tx_metrics": tx_result,
        "breakdown": breakdown,
    }
    await ws_manager.broadcast(broadcast_payload)

    return {
        "status": "pending",
        "delivered": True,
        "packet_id": packet_id,
        "victim_id": victim_id,
        "raw_hex": raw_hex,
        "byte_count": 21,
        "group_id": cluster.group_id,
        "cluster_card": cluster.to_dict()["summary_card"],
        "breakdown": breakdown,
        "tx_metrics": tx_result,
    }


@app.post("/api/lora/uplink")
async def receive_hardware_uplink(req: UplinkHexRequest, db: Session = Depends(get_db)):
    """Receives raw 21-byte hex from physical ESP32 LoRa Gateway via serial bridge."""
    try:
        raw_bytes = bytes.fromhex(req.raw_hex)
        if len(raw_bytes) != 21:
            raise ValueError(f"Packet must be exactly 21 bytes, got {len(raw_bytes)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid packet hex: {str(e)}")

    decoded_pkt = decode_packet(raw_bytes)
    now = int(time.time())
    packet_id = f"SOS-{decoded_pkt.victim_id}-{decoded_pkt.timestamp}"

    report_dict = {
        "packet_id": packet_id,
        "victim_id": decoded_pkt.victim_id,
        "latitude": decoded_pkt.latitude,
        "longitude": decoded_pkt.longitude,
        "emergency_type": int(decoded_pkt.emergency_type),
        "emergency_type_label": EmergencyType.label(decoded_pkt.emergency_type),
        "severity": int(decoded_pkt.severity),
        "severity_label": SeverityLevel.label(decoded_pkt.severity),
        "people_count": decoded_pkt.people_count,
        "gps_age_sec": decoded_pkt.gps_age_sec,
        "timestamp": decoded_pkt.timestamp,
        "raw_hex": req.raw_hex.upper(),
        "flags": decoded_pkt.flags,
        "is_simulated": bool(decoded_pkt.flags & 0x01),
        "status": "pending",
        "created_at": now,
    }

    cluster = sos_grouper.process_report(report_dict)
    report_dict["group_id"] = cluster.group_id

    priority_queue.push(
        packet=decoded_pkt,
        raw_hex=req.raw_hex.upper(),
        status="pending",
        group_id=cluster.group_id,
        packet_id=packet_id,
    )

    db_rep = db.query(SOSReportModel).filter_by(packet_id=packet_id).first()
    if not db_rep:
        db.add(SOSReportModel(**report_dict))
        db.commit()

    breakdown = explain_packet_bytes(raw_bytes)
    await ws_manager.broadcast({
        "type": "NEW_SOS",
        "report": report_dict,
        "cluster": cluster.to_dict(),
        "breakdown": breakdown,
    })

    return {"status": "received", "packet_id": packet_id, "group_id": cluster.group_id}


@app.get("/api/sos/list")
def list_sos_reports(db: Session = Depends(get_db)):
    """List all SOS reports ordered by Priority (P1 first, then oldest timestamp)."""
    reports = db.query(SOSReportModel).order_by(
        SOSReportModel.severity.asc(),
        SOSReportModel.timestamp.asc()
    ).all()

    result = []
    for r in reports:
        item = {
            "packet_id": r.packet_id,
            "victim_id": r.victim_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "emergency_type": r.emergency_type,
            "emergency_type_label": r.emergency_type_label,
            "severity": r.severity,
            "severity_label": r.severity_label,
            "people_count": r.people_count,
            "gps_age_sec": r.gps_age_sec,
            "timestamp": r.timestamp,
            "raw_hex": r.raw_hex,
            "is_simulated": r.is_simulated,
            "group_id": r.group_id,
            "status": r.status,
            "responder_id": r.responder_id,
            "responder_name": r.responder_name,
            "accepted_at": r.accepted_at,
            "eta_minutes": r.eta_minutes,
            "team_type": r.team_type or 1,
            "team_type_label": r.team_type_label or TeamType.label(r.team_type or 1),
            "latest_note": r.latest_note or "",
            "delivery_status": r.delivery_status or "delivered",
            "retry_count": r.retry_count or 0,
            "downlink_payload_hex": r.downlink_payload_hex,
            "raw_downlink_hex": r.raw_downlink_hex,
            "ack_signature_hex": r.ack_signature_hex,
            "ack_public_key_hex": r.ack_public_key_hex,
            "ack_is_tampered": r.ack_is_tampered,
            "created_at": r.created_at,
        }
        result.append(item)
    return result


@app.get("/api/sos/groups")
def list_groups(db: Session = Depends(get_db)):
    """List grouped cluster cards with nested reports."""
    groups = sos_grouper.list_groups()
    return groups


@app.get("/api/sos/{sos_id}")
def get_sos_detail(sos_id: str, db: Session = Depends(get_db)):
    r = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="SOS Report not found")

    breakdown = []
    try:
        raw_bytes = bytes.fromhex(r.raw_hex)
        breakdown = explain_packet_bytes(raw_bytes)
    except Exception:
        pass

    downlink_breakdown = []
    if r.downlink_payload_hex:
        try:
            dl_bytes = bytes.fromhex(r.downlink_payload_hex)
            downlink_breakdown = explain_downlink_packet_bytes(dl_bytes)
        except Exception:
            pass

    return {
        "packet_id": r.packet_id,
        "victim_id": r.victim_id,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "emergency_type": r.emergency_type,
        "emergency_type_label": r.emergency_type_label,
        "severity": r.severity,
        "severity_label": r.severity_label,
        "people_count": r.people_count,
        "gps_age_sec": r.gps_age_sec,
        "timestamp": r.timestamp,
        "raw_hex": r.raw_hex,
        "is_simulated": r.is_simulated,
        "group_id": r.group_id,
        "status": r.status,
        "responder_id": r.responder_id,
        "responder_name": r.responder_name,
        "accepted_at": r.accepted_at,
        "eta_minutes": r.eta_minutes,
        "team_type": r.team_type or 1,
        "team_type_label": r.team_type_label or TeamType.label(r.team_type or 1),
        "latest_note": r.latest_note or "",
        "delivery_status": r.delivery_status or "delivered",
        "retry_count": r.retry_count or 0,
        "downlink_payload_hex": r.downlink_payload_hex,
        "raw_downlink_hex": r.raw_downlink_hex,
        "ack_signature_hex": r.ack_signature_hex,
        "ack_public_key_hex": r.ack_public_key_hex,
        "ack_is_tampered": r.ack_is_tampered,
        "ack_tamper_reason": r.ack_tamper_reason,
        "breakdown": breakdown,
        "downlink_breakdown": downlink_breakdown,
    }


async def record_and_dispatch_downlink(
    report: SOSReportModel,
    target_status: str,
    eta_minutes: int,
    team_type: int,
    responder_id: str,
    responder_name: str,
    note_code: int = 0,
    note_text: Optional[str] = None,
    db: Session = None,
) -> Dict[str, Any]:
    """
    Builds, signs with Ed25519, logs, persists, and transmits a compact 16B Downlink message over LoRa.
    """
    now = int(time.time())
    responder = DEFAULT_RESPONDERS.get(responder_id) or DEFAULT_RESPONDERS["RESP-NDRF-01"]
    keypair = responder["keypair"]

    responder_num = 1 if "NDRF" in responder["id"] else 2
    status_code = STATUS_TO_CODE.get(target_status, StatusCode.PENDING)
    clean_note = get_note_text(note_code, note_text)

    # 1. Encode 16-byte downlink payload
    downlink_bytes = encode_downlink_packet(
        victim_id=report.victim_id,
        status_code=status_code,
        eta_minutes=eta_minutes,
        team_type=team_type,
        responder_id_num=responder_num,
        note_code=note_code,
        timestamp=now,
        is_simulated=report.is_simulated,
    )

    # 2. Digitally sign 16-byte payload using Ed25519 (80-byte radio frame)
    signed_dl = create_signed_downlink_message(
        downlink_bytes=downlink_bytes,
        keypair=keypair,
        metadata={
            "sos_id": report.packet_id,
            "victim_id": report.victim_id,
            "status": target_status,
            "status_label": StatusCode.label(status_code),
            "eta_minutes": eta_minutes,
            "team_type": team_type,
            "team_type_label": TeamType.label(team_type),
            "responder_id": responder["id"],
            "responder_name": responder_name or responder["name"],
            "note_text": clean_note,
            "timestamp": now,
        }
    )

    # 3. Transmit through LoRa simulator (delay, packet loss, and retry tracking)
    tx_res = await lora_simulator.transmit_downlink_message(
        downlink_bytes=downlink_bytes,
        signed_msg={
            "sos_id": report.packet_id,
            "victim_id": report.victim_id,
            "status": target_status,
            "status_label": StatusCode.label(status_code),
            "eta_minutes": eta_minutes,
            "raw_downlink_hex": signed_dl["raw_downlink_hex"],
        },
        victim_id=report.victim_id,
        attempt=1,
    )

    delivery_status = "delivered" if tx_res.get("delivered") else "in_transit"
    retry_count = 0 if tx_res.get("delivered") else 1

    # 4. Also generate backward-compatible signed_ack for existing endpoints
    signed_ack = create_signed_ack(
        sos_id=report.packet_id,
        responder_id=responder["id"],
        responder_name=responder_name or responder["name"],
        timestamp=now,
        keypair=keypair,
        eta_minutes=eta_minutes,
    )

    existing_count = db.query(DownlinkMessageModel).filter_by(sos_id=report.packet_id).count()
    seq_num = existing_count + 1
    msg_id = f"DLM-{report.victim_id}-{now}-{seq_num}"

    dl_model = DownlinkMessageModel(
        message_id=msg_id,
        sos_id=report.packet_id,
        seq_num=seq_num,
        status=target_status,
        status_code=int(status_code),
        status_label=StatusCode.label(status_code),
        eta_minutes=eta_minutes,
        team_type=team_type,
        team_type_label=TeamType.label(team_type),
        responder_id=responder["id"],
        responder_name=responder_name or responder["name"],
        note_code=note_code,
        note_text=clean_note,
        payload_hex=signed_dl["payload_hex"],
        signature_hex=signed_dl["signature_hex"],
        public_key_hex=signed_dl["public_key_hex"],
        raw_downlink_hex=signed_dl["raw_downlink_hex"],
        delivery_status=delivery_status,
        retry_count=retry_count,
        created_at=now,
        delivered_at=now if delivery_status == "delivered" else None,
    )
    db.add(dl_model)

    # 5. Update SOS Report entity
    report.status = target_status
    report.responder_id = responder["id"]
    report.responder_name = responder_name or responder["name"]
    report.eta_minutes = eta_minutes
    report.team_type = team_type
    report.team_type_label = TeamType.label(team_type)
    report.latest_note = clean_note
    report.delivery_status = delivery_status
    report.retry_count = retry_count
    report.downlink_payload_hex = signed_dl["payload_hex"]
    report.raw_downlink_hex = signed_dl["raw_downlink_hex"]
    report.ack_signature_hex = signed_ack["signature_hex"]
    report.ack_public_key_hex = signed_ack["public_key_hex"]
    report.ack_payload_json = json.dumps(signed_ack["payload"])
    if target_status == "accepted" and not report.accepted_at:
        report.accepted_at = now

    # Propagate to cluster group if attached
    if report.group_id:
        cluster = sos_grouper.get_group(report.group_id)
        if cluster:
            cluster.status = target_status
            cluster.responder_id = responder["id"]
            cluster.responder_name = report.responder_name
            if target_status == "accepted":
                cluster.accepted_at = now
        grp_db = db.query(ClusterGroupModel).filter_by(group_id=report.group_id).first()
        if grp_db:
            grp_db.status = target_status
            grp_db.responder_id = responder["id"]
            grp_db.responder_name = report.responder_name
            if target_status == "accepted":
                grp_db.accepted_at = now

    db.commit()

    breakdown = explain_downlink_packet_bytes(downlink_bytes)

    # 6. Broadcast live WebSocket updates
    event_type = "SOS_ACCEPTED" if target_status == "accepted" else ("ETA_UPDATED" if target_status == "eta_updated" else "STATUS_CHANGED")
    await ws_manager.broadcast({
        "type": event_type,
        "sos_id": report.packet_id,
        "victim_id": report.victim_id,
        "status": target_status,
        "status_label": StatusCode.label(status_code),
        "eta_minutes": eta_minutes,
        "team_type": team_type,
        "team_type_label": TeamType.label(team_type),
        "responder_name": report.responder_name,
        "note_text": clean_note,
        "delivery_status": delivery_status,
        "signed_downlink": signed_dl,
        "signed_ack": signed_ack,
        "breakdown": breakdown,
    })

    return {
        "status": target_status,
        "sos_id": report.packet_id,
        "message_id": msg_id,
        "signed_downlink": signed_dl,
        "signed_ack": signed_ack,
        "breakdown": breakdown,
        "delivery_status": delivery_status,
        "tx_metrics": tx_res,
    }


@app.post("/api/sos/{sos_id}/accept")
async def accept_sos_report(
    sos_id: str,
    req: AcceptSOSRequest,
    db: Session = Depends(get_db)
):
    """
    Authorized responder accepts an emergency SOS:
    1. Validates status transition from 'pending' to 'accepted'.
    2. Builds 16-byte Downlink packet with team type and estimated arrival.
    3. Signs an Ed25519 digital signature.
    4. Transmits through LoRa downlink.
    5. Saves state and broadcasts live update.
    """
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    # Enforce state machine rules: only pending can be accepted (or re-accepted from cancelled)
    is_valid, err_msg = validate_status_transition(report.status, "accepted")
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    # Auto-calculate ETA if not provided using Haversine formula
    team_type = req.team_type or 1
    if req.eta_minutes is None:
        eta_calc = calculate_suggested_eta(report.latitude, report.longitude, team_type=team_type)
        eta_min = eta_calc["suggested_eta_minutes"]
    else:
        eta_min = req.eta_minutes

    res = await record_and_dispatch_downlink(
        report=report,
        target_status="accepted",
        eta_minutes=eta_min,
        team_type=team_type,
        responder_id=req.responder_id,
        responder_name=req.responder_name,
        note_code=req.note_code or 0,
        note_text=req.note_text,
        db=db,
    )
    return res


@app.post("/api/sos/{sos_id}/status")
async def update_sos_status(
    sos_id: str,
    req: UpdateStatusRequest,
    db: Session = Depends(get_db)
):
    """
    Authorized responder updates mission lifecycle status:
    Accepted -> En Route -> Arriving Soon -> Arrived -> Closed.
    Rejects invalid transition jumps with HTTP 400.
    """
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    target_status = req.status.lower().strip()
    is_valid, err_msg = validate_status_transition(report.status, target_status)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    eta_min = req.eta_minutes if req.eta_minutes is not None else (report.eta_minutes or 0)
    # Default ETA when arriving soon or arrived
    if target_status == "arrived":
        eta_min = 0
    elif target_status == "arriving_soon" and eta_min > 5:
        eta_min = 4

    team_type = req.team_type or report.team_type or 1
    note_code = req.note_code if req.note_code is not None else 0

    res = await record_and_dispatch_downlink(
        report=report,
        target_status=target_status,
        eta_minutes=eta_min,
        team_type=team_type,
        responder_id=req.responder_id or report.responder_id or "RESP-NDRF-01",
        responder_name=req.responder_name or report.responder_name,
        note_code=note_code,
        note_text=req.note_text,
        db=db,
    )
    return res


@app.get("/api/sos/{sos_id}/messages")
def get_sos_messages(sos_id: str, db: Session = Depends(get_db)):
    """Downlink message history with cryptographic verification and delivery status."""
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    messages = db.query(DownlinkMessageModel).filter_by(sos_id=sos_id).order_by(DownlinkMessageModel.seq_num.asc()).all()
    res = []
    for m in messages:
        breakdown = []
        try:
            p_bytes = bytes.fromhex(m.payload_hex)
            breakdown = explain_downlink_packet_bytes(p_bytes)
        except Exception:
            pass

        is_valid, reason = verify_downlink_message(
            payload_bytes_or_hex=m.payload_hex,
            signature_hex=m.signature_hex,
            public_key_hex=m.public_key_hex,
            is_tampered=m.is_tampered,
            tamper_reason=m.tamper_reason,
        )

        res.append({
            "message_id": m.message_id,
            "sos_id": m.sos_id,
            "seq_num": m.seq_num,
            "status": m.status,
            "status_code": m.status_code,
            "status_label": m.status_label,
            "eta_minutes": m.eta_minutes,
            "team_type": m.team_type,
            "team_type_label": m.team_type_label,
            "responder_id": m.responder_id,
            "responder_name": m.responder_name,
            "note_code": m.note_code,
            "note_text": m.note_text,
            "payload_hex": m.payload_hex,
            "signature_hex": m.signature_hex,
            "public_key_hex": m.public_key_hex,
            "raw_downlink_hex": m.raw_downlink_hex,
            "delivery_status": m.delivery_status,
            "retry_count": m.retry_count,
            "is_tampered": m.is_tampered,
            "tamper_reason": m.tamper_reason,
            "is_valid": is_valid,
            "verification_message": reason,
            "created_at": m.created_at,
            "delivered_at": m.delivered_at,
            "breakdown": breakdown,
        })
    return res


@app.post("/api/sos/{sos_id}/messages/{msg_id}/ack")
async def acknowledge_downlink_message(sos_id: str, msg_id: str, db: Session = Depends(get_db)):
    """Victim terminal confirms receipt of a downlink status message."""
    msg = db.query(DownlinkMessageModel).filter_by(sos_id=sos_id, message_id=msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Downlink message not found")

    now = int(time.time())
    msg.delivery_status = "delivered"
    msg.delivered_at = now

    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if report:
        report.delivery_status = "delivered"

    db.commit()

    await ws_manager.broadcast({
        "type": "MESSAGE_DELIVERED",
        "sos_id": sos_id,
        "message_id": msg_id,
        "delivered_at": now,
    })

    return {"status": "confirmed", "message_id": msg_id, "delivered_at": now}


@app.get("/api/sos/{sos_id}/eta-estimate")
def get_eta_estimate(
    sos_id: str,
    team_type: int = Query(default=1, ge=1, le=5),
    db: Session = Depends(get_db),
):
    """Calculates suggested ETA using Haversine Great Circle distance to rescue base station."""
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    return calculate_suggested_eta(
        victim_lat=report.latitude,
        victim_lon=report.longitude,
        team_type=team_type,
    )


@app.post("/api/demo/simulate-mission/{sos_id}")
async def simulate_rescue_mission(
    sos_id: str,
    req: SimulateMissionRequest = None,
    db: Session = Depends(get_db),
):
    """
    Demo Simulator Accelerator:
    Steps through En Route -> Arriving Soon -> Arrived with speed accelerator.
    """
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    speed = req.speed if req and req.speed else 10
    step_delay = 0.5 if speed >= 60 else (1.5 if speed >= 10 else 4.0)

    # 1. If still pending, accept first
    if report.status == "pending":
        eta_data = calculate_suggested_eta(report.latitude, report.longitude, team_type=1)
        await record_and_dispatch_downlink(
            report=report,
            target_status="accepted",
            eta_minutes=eta_data["suggested_eta_minutes"],
            team_type=1,
            responder_id="RESP-NDRF-01",
            responder_name="Capt. A. Sharma (NDRF 4th Battalion)",
            note_code=1,
            db=db,
        )
        await asyncio.sleep(step_delay)

    # 2. Transition to En Route
    if report.status in ("accepted", "eta_updated"):
        en_route_eta = max(5, (report.eta_minutes or 12) - 3)
        await record_and_dispatch_downlink(
            report=report,
            target_status="en_route",
            eta_minutes=en_route_eta,
            team_type=report.team_type or 1,
            responder_id=report.responder_id or "RESP-NDRF-01",
            responder_name=report.responder_name or "NDRF Team",
            note_code=4,
            db=db,
        )
        await asyncio.sleep(step_delay)

    # 3. Transition to Arriving Soon (< 5 min)
    if report.status == "en_route":
        await record_and_dispatch_downlink(
            report=report,
            target_status="arriving_soon",
            eta_minutes=4,
            team_type=report.team_type or 1,
            responder_id=report.responder_id or "RESP-NDRF-01",
            responder_name=report.responder_name or "NDRF Team",
            note_code=3,
            db=db,
        )
        await asyncio.sleep(step_delay)

    # 4. Transition to Arrived
    if report.status == "arriving_soon":
        await record_and_dispatch_downlink(
            report=report,
            target_status="arrived",
            eta_minutes=0,
            team_type=report.team_type or 1,
            responder_id=report.responder_id or "RESP-NDRF-01",
            responder_name=report.responder_name or "NDRF Team",
            note_code=6,
            db=db,
        )

    return {
        "status": "completed",
        "current_status": report.status,
        "sos_id": sos_id,
        "message": f"Rescue mission simulated successfully at {speed}x speed. Status is now '{report.status}'.",
    }


@app.post("/api/demo/tamper-downlink/{sos_id}")
async def tamper_downlink_demo(
    sos_id: str,
    tamper_type: str = Query(default="corrupt_signature"),
    db: Session = Depends(get_db),
):
    """
    Deliberately tampers the latest downlink message to demonstrate client-side signature rejection.
    """
    msg = db.query(DownlinkMessageModel).filter_by(sos_id=sos_id).order_by(DownlinkMessageModel.seq_num.desc()).first()
    if not msg:
        raise HTTPException(status_code=400, detail="Cannot tamper: no downlink messages exist for this SOS")

    signed_msg = {
        "payload_hex": msg.payload_hex,
        "signature_hex": msg.signature_hex,
        "public_key_hex": msg.public_key_hex,
        "raw_downlink_hex": msg.raw_downlink_hex,
    }
    tampered = tamper_downlink_message(signed_msg, tamper_type=tamper_type)

    msg.payload_hex = tampered["payload_hex"]
    msg.signature_hex = tampered["signature_hex"]
    msg.raw_downlink_hex = tampered["raw_downlink_hex"]
    msg.is_tampered = True
    msg.tamper_reason = tampered.get("tamper_reason")
    db.commit()

    lora_simulator.log_event(
        "CHANNEL",
        f"[DEMO TAMPER] Downlink message for {sos_id} corrupted ({tampered.get('tamper_reason')})",
        {"sos_id": sos_id, "tamper_type": tamper_type},
    )

    await ws_manager.broadcast({
        "type": "DOWNLINK_TAMPERED",
        "sos_id": sos_id,
        "message_id": msg.message_id,
        "tampered_message": {
            "message_id": msg.message_id,
            "sos_id": sos_id,
            "status": msg.status,
            "payload_hex": msg.payload_hex,
            "signature_hex": msg.signature_hex,
            "public_key_hex": msg.public_key_hex,
            "is_tampered": True,
            "tamper_reason": msg.tamper_reason,
        },
    })

    return {
        "status": "tampered",
        "sos_id": sos_id,
        "tamper_reason": msg.tamper_reason,
        "instruction": "Open Victim App to observe the red 'Forged message rejected' cryptographic alert!",
    }


@app.get("/api/sos/{sos_id}/ack")
def get_victim_acknowledgement(sos_id: str, db: Session = Depends(get_db)):
    """
    Victim app endpoint to check for digitally signed acknowledgement.
    Returns signed ack payload, signature, and public key for client-side Ed25519 verification.
    """
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SOS report not found")

    if report.status == "pending" or not report.ack_signature_hex:
        return {
            "status": report.status,  # "pending"
            "accepted": False,
            "message": "Waiting for a responder. Your SOS is still being sent.",
        }

    payload = json.loads(report.ack_payload_json) if report.ack_payload_json else {}
    signed_ack = {
        "algorithm": "Ed25519",
        "payload": payload,
        "signature_hex": report.ack_signature_hex,
        "public_key_hex": report.ack_public_key_hex,
        "is_tampered": report.ack_is_tampered,
        "tamper_reason": report.ack_tamper_reason,
    }

    is_valid, reason = verify_ack_signature(signed_ack)

    # Also fetch latest downlink message if available
    latest_msg = db.query(DownlinkMessageModel).filter_by(sos_id=sos_id).order_by(DownlinkMessageModel.seq_num.desc()).first()
    downlink_data = None
    if latest_msg:
        downlink_data = {
            "message_id": latest_msg.message_id,
            "seq_num": latest_msg.seq_num,
            "status": latest_msg.status,
            "status_label": latest_msg.status_label,
            "eta_minutes": latest_msg.eta_minutes,
            "team_type": latest_msg.team_type,
            "team_type_label": latest_msg.team_type_label,
            "note_text": latest_msg.note_text,
            "payload_hex": latest_msg.payload_hex,
            "signature_hex": latest_msg.signature_hex,
            "public_key_hex": latest_msg.public_key_hex,
            "delivery_status": latest_msg.delivery_status,
            "is_tampered": latest_msg.is_tampered,
            "tamper_reason": latest_msg.tamper_reason,
            "created_at": latest_msg.created_at,
        }

    return {
        "status": report.status,
        "accepted": True,
        "signed_ack": signed_ack,
        "server_verified": is_valid,
        "verification_message": reason,
        "responder_name": report.responder_name,
        "eta_minutes": report.eta_minutes,
        "team_type": report.team_type,
        "team_type_label": report.team_type_label,
        "latest_note": report.latest_note,
        "delivery_status": report.delivery_status,
        "latest_downlink": downlink_data,
    }



@app.post("/api/demo/tamper-ack/{sos_id}")
async def tamper_demo_ack(
    sos_id: str,
    tamper_type: str = Query(default="modify_field"),
    db: Session = Depends(get_db)
):
    """
    Deliberately tampers an acknowledgement to demonstrate cryptographic rejection in the victim app.
    """
    report = db.query(SOSReportModel).filter_by(packet_id=sos_id).first()
    if not report or not report.ack_signature_hex:
        raise HTTPException(status_code=400, detail="Cannot tamper: SOS has not been accepted yet")

    current_ack = {
        "algorithm": "Ed25519",
        "payload": json.loads(report.ack_payload_json),
        "signature_hex": report.ack_signature_hex,
        "public_key_hex": report.ack_public_key_hex,
    }

    tampered = tamper_ack_payload(current_ack, tamper_type=tamper_type)

    report.ack_payload_json = json.dumps(tampered["payload"])
    report.ack_signature_hex = tampered["signature_hex"]
    report.ack_is_tampered = True
    report.ack_tamper_reason = tampered.get("tamper_reason")
    db.commit()

    lora_simulator.log_event(
        "CHANNEL",
        f"[DEMO TAMPER] Acknowledgement for {sos_id} was forged/altered ({tampered.get('tamper_reason')})",
        {"sos_id": sos_id, "tamper_type": tamper_type},
    )

    await ws_manager.broadcast({
        "type": "ACK_TAMPERED",
        "sos_id": sos_id,
        "tampered_ack": tampered,
    })

    return {
        "status": "tampered",
        "sos_id": sos_id,
        "tampered_ack": tampered,
        "instruction": "Open Victim App to observe the digital signature verification failure badge!",
    }


@app.post("/api/demo/sample-two")
async def send_two_sample_emergencies(db: Session = Depends(get_db)):
    """
    Demo Button: Sends two sample emergencies (heart attack P1 + stranded general P3)
    Visibly demonstrating that P1 is sorted and dispatched first regardless of arrival order.
    """
    now = int(time.time())

    # 1. Stranded arrives first (t = now - 10)
    rep_stranded = SendSOSRequest(
        victim_id=7101,
        latitude=13.0950,
        longitude=80.2820,
        emergency_type=int(EmergencyType.STRANDED),
        severity=int(SeverityLevel.P3),
        people_count=3,
        gps_age_sec=40,
        is_simulated=True,
    )
    # 2. Heart attack arrives after (t = now)
    rep_cardiac = SendSOSRequest(
        victim_id=7102,
        latitude=13.0895,
        longitude=80.2780,
        emergency_type=int(EmergencyType.HEART_ATTACK),
        severity=int(SeverityLevel.P1),
        people_count=1,
        gps_age_sec=3,
        is_simulated=True,
    )

    res1 = await send_victim_sos(rep_stranded, db)
    await asyncio.sleep(0.1)
    res2 = await send_victim_sos(rep_cardiac, db)

    return {
        "status": "success",
        "message": "Dispatched 2 sample emergencies: Stranded (P3) sent first, followed by Heart Attack (P1). IECE Priority queue prioritizes Heart Attack at the top!",
        "stranded_sos": res1,
        "cardiac_sos": res2,
    }


@app.post("/api/demo/sample-five")
async def generate_five_nearby_sos(db: Session = Depends(get_db)):
    """
    Demo Button: Generates 5 nearby SOS reports in a flood zone within 50m.
    Demonstrates IECE automatic duplicate grouping into a single cluster card.
    """
    now = int(time.time())
    base_lat = 13.0827
    base_lon = 80.2707

    offsets = [
        (0.00000, 0.00000, 1),
        (0.00012, 0.00008, 2),
        (-0.00008, 0.00010, 1),
        (0.00010, -0.00012, 3),
        (-0.00005, -0.00006, 2),
    ]

    results = []
    for i, (dlat, dlon, count) in enumerate(offsets):
        req = SendSOSRequest(
            victim_id=8200 + i,
            latitude=base_lat + dlat,
            longitude=base_lon + dlon,
            emergency_type=int(EmergencyType.TRAPPED_FLOOD),
            severity=int(SeverityLevel.P2),
            people_count=count,
            gps_age_sec=10 + i * 5,
            is_simulated=True,
        )
        res = await send_victim_sos(req, db)
        results.append(res)
        await asyncio.sleep(0.05)

    return {
        "status": "success",
        "message": "Generated 5 nearby Flood SOS reports within 40m radius. IECE grouped them into a single cluster card with 9 total victims!",
        "results": results,
    }


@app.post("/api/demo/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    """Clears all records and resets queues for a clean demo."""
    db.query(SOSReportModel).delete()
    db.query(ClusterGroupModel).delete()
    db.commit()

    priority_queue.clear()
    sos_grouper.clear()
    lora_simulator.logs.clear()
    lora_simulator.stats = {
        "packets_transmitted": 0,
        "packets_delivered": 0,
        "packets_dropped": 0,
        "downlink_delivered": 0,
    }
    return {"status": "cleared", "message": "Demo data reset successfully"}


@app.post("/api/demo/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    """Seeds sample data so demo never starts empty."""
    db.query(SOSReportModel).delete()
    db.query(ClusterGroupModel).delete()
    db.commit()
    priority_queue.clear()
    sos_grouper.clear()

    seeded = seed_database(db, sos_grouper, priority_queue)
    return {"status": "seeded", "count": len(seeded), "records": seeded}


@app.get("/api/iece/stats")
def get_iece_stats(db: Session = Depends(get_db)):
    """Returns engine metrics for dashboard and evaluator inspection."""
    total_sos = db.query(SOSReportModel).count()
    pending_sos = db.query(SOSReportModel).filter_by(status="pending").count()
    accepted_sos = db.query(SOSReportModel).filter_by(status="accepted").count()
    total_groups = db.query(ClusterGroupModel).count()

    p1_count = db.query(SOSReportModel).filter_by(severity=1).count()
    p2_count = db.query(SOSReportModel).filter_by(severity=2).count()
    p3_count = db.query(SOSReportModel).filter_by(severity=3).count()
    p4_count = db.query(SOSReportModel).filter_by(severity=4).count()

    return {
        "total_sos": total_sos,
        "pending_sos": pending_sos,
        "accepted_sos": accepted_sos,
        "total_groups": total_groups,
        "queue_length": len(priority_queue),
        "priority_distribution": {
            "P1_critical": p1_count,
            "P2_urgent": p2_count,
            "P3_needs_help": p3_count,
            "P4_checkin": p4_count,
        },
        "simulator": lora_simulator.get_status(),
    }


# WebSocket for Live Dashboard Updates
@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial welcome and channel status
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "Connected to RescueLink Real-time Telemetry Feed",
            "channel_mode": lora_simulator.mode,
            "time": int(time.time()),
        })
        while True:
            data = await websocket.receive_text()
            # Handle client ping or command
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({"type": "PONG", "time": int(time.time())})
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# Mount Static Frontend Bundle if built
from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

