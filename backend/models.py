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
    status = Column(String(32), nullable=False, default="pending")  # pending, accepted, resolved
    responder_id = Column(String(64), nullable=True)
    responder_name = Column(String(128), nullable=True)
    accepted_at = Column(BigInteger, nullable=True)
    eta_minutes = Column(Integer, nullable=True)

    # Cryptographic fields
    ack_signature_hex = Column(Text, nullable=True)
    ack_public_key_hex = Column(String(128), nullable=True)
    ack_payload_json = Column(Text, nullable=True)
    ack_is_tampered = Column(Boolean, nullable=False, default=False)
    ack_tamper_reason = Column(String(255), nullable=True)

    created_at = Column(BigInteger, nullable=False)


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
