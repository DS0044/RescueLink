"""
End-to-end integration tests for Mission Lifecycle, Status Updates, ETA, and Downlink Acks.
"""

import sys
import os
import pytest
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import init_db
from simulator import lora_simulator

lora_simulator.delay_ms = 10
lora_simulator.packet_loss_percent = 0.0


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


@pytest.mark.asyncio
async def test_full_mission_lifecycle():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Send an emergency SOS
        sos_res = await client.post(
            "/api/sos/send",
            json={
                "victim_id": 9901,
                "latitude": 17.3950,
                "longitude": 78.4967,
                "emergency_type": 2,  # Trapped in Flood
                "people_count": 2,
                "gps_age_sec": 5,
                "is_simulated": True,
            },
        )
        assert sos_res.status_code == 200
        sos_id = sos_res.json()["packet_id"]

        # 2. Verify victim status before acceptance is STRICTLY PENDING
        ack_res0 = await client.get(f"/api/sos/{sos_id}/ack")
        assert ack_res0.status_code == 200
        assert ack_res0.json()["accepted"] is False
        assert ack_res0.json()["status"] == "pending"

        # 3. Test Invalid Transition Rejection: jumping from 'pending' to 'arrived' or 'en_route' MUST be rejected with 400
        inv_jump = await client.post(
            f"/api/sos/{sos_id}/status",
            json={"status": "arrived"},
        )
        assert inv_jump.status_code == 400
        assert "Invalid transition" in inv_jump.json()["detail"]

        # 4. Haversine ETA estimate check
        eta_est = await client.get(f"/api/sos/{sos_id}/eta-estimate?team_type=1")
        assert eta_est.status_code == 200
        eta_data = eta_est.json()
        assert eta_data["distance_km"] > 0
        assert eta_data["suggested_eta_minutes"] >= 1
        suggested_eta = eta_data["suggested_eta_minutes"]

        # 5. Responder accepts SOS with team type Boat (1) and suggested ETA
        accept_res = await client.post(
            f"/api/sos/{sos_id}/accept",
            json={
                "responder_id": "RESP-NDRF-01",
                "responder_name": "Capt. A. Sharma (NDRF 4th Bn)",
                "eta_minutes": suggested_eta,
                "team_type": 1,
                "note_code": 1,  # "Stay where you are"
            },
        )
        assert accept_res.status_code == 200
        accept_json = accept_res.json()
        assert accept_json["status"] == "accepted"
        assert "signed_downlink" in accept_json
        assert accept_json["signed_downlink"]["payload_bytes_len"] == 16
        assert accept_json["signed_downlink"]["total_bytes_len"] == 80

        # 6. Status transition: Accepted -> En Route
        en_route_res = await client.post(
            f"/api/sos/{sos_id}/status",
            json={
                "status": "en_route",
                "eta_minutes": max(1, suggested_eta - 2),
                "note_code": 4,  # "Stay on roof / elevated structure"
            },
        )
        assert en_route_res.status_code == 200
        assert en_route_res.json()["status"] == "en_route"

        # 7. Status transition: En Route -> Arriving Soon (< 5 min)
        arriving_res = await client.post(
            f"/api/sos/{sos_id}/status",
            json={
                "status": "arriving_soon",
                "eta_minutes": 3,
                "note_code": 3,  # "Show a light or signal"
            },
        )
        assert arriving_res.status_code == 200
        assert arriving_res.json()["status"] == "arriving_soon"

        # 8. Status transition: Arriving Soon -> Arrived
        arrived_res = await client.post(
            f"/api/sos/{sos_id}/status",
            json={
                "status": "arrived",
                "eta_minutes": 0,
                "note_code": 6,  # "Help is right outside"
            },
        )
        assert arrived_res.status_code == 200
        assert arrived_res.json()["status"] == "arrived"

        # 9. Verify Downlink Message History
        msg_history_res = await client.get(f"/api/sos/{sos_id}/messages")
        assert msg_history_res.status_code == 200
        messages = msg_history_res.json()
        assert len(messages) == 4  # accepted, en_route, arriving_soon, arrived
        assert messages[0]["status"] == "accepted"
        assert messages[1]["status"] == "en_route"
        assert messages[2]["status"] == "arriving_soon"
        assert messages[3]["status"] == "arrived"

        for m in messages:
            assert m["is_valid"] is True
            assert len(m["breakdown"]) == 8

        # 10. Victim acknowledges delivery of latest message
        latest_msg_id = messages[-1]["message_id"]
        ack_msg_res = await client.post(f"/api/sos/{sos_id}/messages/{latest_msg_id}/ack")
        assert ack_msg_res.status_code == 200
        assert ack_msg_res.json()["status"] == "confirmed"

        # 11. Test Tamper Downlink Demo
        tamper_res = await client.post(f"/api/demo/tamper-downlink/{sos_id}")
        assert tamper_res.status_code == 200
        tamper_data = tamper_res.json()
        assert tamper_data["status"] == "tampered"

        # Check that tampered message now fails verification
        updated_history = await client.get(f"/api/sos/{sos_id}/messages")
        last_msg = updated_history.json()[-1]
        assert last_msg["is_tampered"] is True
        assert last_msg["is_valid"] is False
        assert "REJECTED" in last_msg["verification_message"]


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_full_mission_lifecycle())
    print("\n✓ Full Mission Lifecycle Integration Tests Passed!")
