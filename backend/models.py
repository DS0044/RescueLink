"""SQLAlchemy Models for RescueLink (PostgreSQL compatible SQLite)."""

from sqlalchemy import Column, String, Integer, Float, Boolean, Text, BigInteger
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class SOSReportModel(Base):
    __tablename__ = "sos_reports"

    packet_id = Column(String(64), primary_key=True, index=True)
    victim_id = Column(BigInteger, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    emergency_type = Column(Integer, nullable=False, index=True)
    emergency_type_label = Column(String(64), nullable=False)
    severity = Column(Integer, nullable=False, index=True)
    severity_label = Column(String(64), nullable=False)
    people_count = Column(Integer, nullable=False, default=1)
    gps_age_sec = Column(Integer, nullable=False, default=0)
    timestamp = Column(BigInteger, nullable=False, index=True)
    raw_hex = Column(String(64), nullable=False)
    flags = Column(Integer, nullable=False, default=1)
    is_simulated = Column(Boolean, nullable=False, default=True)
    group_id = Column(String(64), nullable=True, index=True)
    status = Column(String(32), nullable=False, default="pending")  # pending, accepted, en_route, arriving_soon, arrived, closed, eta_updated, cancelled
    responder_id = Column(String(64), nullable=True)
    responder_name = Column(String(128), nullable=True)
    accepted_at = Column(BigInteger, nullable=True)
    eta_minutes = Column(Integer, nullable=True)

    # Mission details
    team_type = Column(Integer, nullable=True)
    team_type_label = Column(String(64), nullable=True)
    latest_note = Column(String(255), nullable=True)
    delivery_status = Column(String(32), nullable=False, default="delivered")  # delivered, in_transit, failed
    retry_count = Column(Integer, nullable=False, default=0)

    # Cryptographic fields
    ack_signature_hex = Column(Text, nullable=True)
    ack_public_key_hex = Column(String(128), nullable=True)
    ack_payload_json = Column(Text, nullable=True)
    ack_is_tampered = Column(Boolean, nullable=False, default=False)
    ack_tamper_reason = Column(String(255), nullable=True)

    # Downlink binary packet
    downlink_payload_hex = Column(String(64), nullable=True)
    raw_downlink_hex = Column(Text, nullable=True)

    created_at = Column(BigInteger, nullable=False)


class DownlinkMessageModel(Base):
    __tablename__ = "downlink_messages"

    message_id = Column(String(64), primary_key=True, index=True)
    sos_id = Column(String(64), nullable=False, index=True)
    seq_num = Column(Integer, nullable=False, default=1)
    status = Column(String(32), nullable=False)  # accepted, en_route, arriving_soon, arrived, eta_updated, etc.
    status_code = Column(Integer, nullable=False)
    status_label = Column(String(64), nullable=False)
    eta_minutes = Column(Integer, nullable=False, default=0)
    team_type = Column(Integer, nullable=False, default=1)
    team_type_label = Column(String(64), nullable=False)
    responder_id = Column(String(64), nullable=False)
    responder_name = Column(String(128), nullable=False)
    note_code = Column(Integer, nullable=False, default=0)
    note_text = Column(String(255), nullable=True)

    # Cryptographic fields
    payload_hex = Column(String(64), nullable=False)
    signature_hex = Column(Text, nullable=False)
    public_key_hex = Column(String(128), nullable=False)
    raw_downlink_hex = Column(Text, nullable=False)

    # Delivery tracking & retry state
    delivery_status = Column(String(32), nullable=False, default="delivered")  # delivered, in_transit, failed
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    is_tampered = Column(Boolean, nullable=False, default=False)
    tamper_reason = Column(String(255), nullable=True)

    created_at = Column(BigInteger, nullable=False)
    delivered_at = Column(BigInteger, nullable=True)


class ClusterGroupModel(Base):
    __tablename__ = "cluster_groups"

    group_id = Column(String(64), primary_key=True, index=True)
    emergency_type = Column(Integer, nullable=False)
    emergency_type_label = Column(String(64), nullable=False)
    severity = Column(Integer, nullable=False)
    severity_label = Column(String(64), nullable=False)
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    total_people = Column(Integer, nullable=False, default=1)
    status = Column(String(32), nullable=False, default="pending")
    responder_id = Column(String(64), nullable=True)
    responder_name = Column(String(128), nullable=True)
    accepted_at = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
