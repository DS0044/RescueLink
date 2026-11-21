"""Integration tests for RescueLink FastAPI endpoints and simulated LoRa link using AsyncClient."""

import pytest
import httpx
from main import app
from database import init_db
from simulator import lora_simulator

# Fast simulation for unit testing
lora_simulator.delay_ms = 10
lora_simulator.packet_loss_percent = 0.0


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


@pytest.mark.asyncio
async def test_health_check():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "link_mode" in data


@pytest.mark.asyncio
async def test_send_sos_and_verify_packet_breakdown():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "victim_id": 4321,
            "latitude": 13.0827,
            "longitude": 80.2707,
            "emergency_type": 2,  # Trapped in Flood
            "people_count": 3,
            "gps_age_sec": 15,
            "is_simulated": True,
        }
        res = await client.post("/api/sos/send", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["delivered"] is True
        assert data["byte_count"] == 21
        assert len(data["raw_hex"]) == 42  # 21 bytes = 42 hex chars
        assert "breakdown" in data
        assert len(data["breakdown"]) == 8


@pytest.mark.asyncio
async def test_sos_list_ordered_by_priority():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/sos/list")
        assert res.status_code == 200
        reports = res.json()
        assert len(reports) > 0
        severities = [r["severity"] for r in reports]
        assert severities == sorted(severities)


@pytest.mark.asyncio
async def test_accept_sos_and_signed_acknowledgement_flow():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Send an SOS
        send_res = await client.post(
            "/api/sos/send",
            json={
                "victim_id": 5555,
                "latitude": 13.0850,
                "longitude": 80.2750,
                "emergency_type": 1,  # Heart Attack P1
                "people_count": 1,
                "is_simulated": True,
            },
        )
        assert send_res.status_code == 200
        packet_id = send_res.json()["packet_id"]

        # 2. Check victim status before responder accepts -> MUST BE PENDING
        ack_res1 = await client.get(f"/api/sos/{packet_id}/ack")
        assert ack_res1.status_code == 200
        assert ack_res1.json()["accepted"] is False
        assert ack_res1.json()["status"] == "pending"

        # 3. Authorized responder accepts
        accept_res = await client.post(
            f"/api/sos/{packet_id}/accept",
            json={
                "responder_id": "RESP-NDRF-01",
                "responder_name": "Capt. A. Sharma (NDRF)",
                "eta_minutes": 10,
            },
        )
        assert accept_res.status_code == 200
        accept_data = accept_res.json()
        assert accept_data["status"] == "accepted"
        signed_ack = accept_data["signed_ack"]
        assert signed_ack["algorithm"] == "Ed25519"
        assert len(signed_ack["signature_hex"]) == 128

        # 4. Check victim status after acceptance -> MUST BE ACCEPTED
        ack_res2 = await client.get(f"/api/sos/{packet_id}/ack")
        assert ack_res2.status_code == 200
        ack_data2 = ack_res2.json()
        assert ack_data2["accepted"] is True
        assert ack_data2["server_verified"] is True
        assert ack_data2["responder_name"] == "Capt. A. Sharma (NDRF)"

        # 5. Tamper test: tamper the acknowledgement
        tamper_res = await client.post(f"/api/demo/tamper-ack/{packet_id}?tamper_type=modify_field")
        assert tamper_res.status_code == 200

        # 6. Check victim status again -> MUST DETECT TAMPER
        ack_res3 = await client.get(f"/api/sos/{packet_id}/ack")
        assert ack_res3.status_code == 200
        assert ack_res3.json()["signed_ack"]["is_tampered"] is True
        assert ack_res3.json()["server_verified"] is False


@pytest.mark.asyncio
async def test_demo_sample_two_priority():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/demo/sample-two")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"


@pytest.mark.asyncio
async def test_demo_sample_five_grouping():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/demo/sample-five")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert len(data["results"]) == 5
