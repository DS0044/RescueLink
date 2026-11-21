"""
Integration tests for Mission Lifecycle, Status Updates, ETA, and Downlink Acks against live server.
"""

import urllib.request
import json
import time


def req(method: str, path: str, data: dict = None) -> dict:
    url = f"http://127.0.0.1:8000{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    request_obj = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request_obj) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def test_full_mission_lifecycle():
    print("\n--- Testing Full Mission Lifecycle ---")
    # 1. Send an emergency SOS
    status, sos_data = req("POST", "/api/sos/send", {
        "victim_id": 9901,
        "latitude": 17.3950,
        "longitude": 78.4967,
        "emergency_type": 2,  # Trapped in Flood
        "people_count": 2,
        "gps_age_sec": 5,
        "is_simulated": True,
    })
    assert status == 200, f"Failed to send SOS: {sos_data}"
    sos_id = sos_data["packet_id"]
    print(f"✓ 1. Sent SOS: {sos_id}")

    # 2. Verify victim status before acceptance is STRICTLY PENDING
    status, ack_data = req("GET", f"/api/sos/{sos_id}/ack")
    assert status == 200
    assert ack_data["accepted"] is False
    assert ack_data["status"] == "pending"
    print("✓ 2. Victim status is strictly pending before responder acceptance")

    # 3. Test Invalid Transition Rejection: jumping from 'pending' to 'arrived' MUST be rejected with 400
    status, err_data = req("POST", f"/api/sos/{sos_id}/status", {"status": "arrived"})
    assert status == 400
    assert "Invalid transition" in err_data["detail"]
    print("✓ 3. Invalid jump (pending -> arrived) correctly rejected with HTTP 400")

    # 4. Haversine ETA estimate check
    status, eta_data = req("GET", f"/api/sos/{sos_id}/eta-estimate?team_type=1")
    assert status == 200
    assert eta_data["distance_km"] > 0
    assert eta_data["suggested_eta_minutes"] >= 1
    suggested_eta = eta_data["suggested_eta_minutes"]
    print(f"✓ 4. Haversine distance: {eta_data['distance_km']} km, Suggested ETA: {suggested_eta} min")

    # 5. Responder accepts SOS with team type Boat (1) and suggested ETA
    status, accept_json = req("POST", f"/api/sos/{sos_id}/accept", {
        "responder_id": "RESP-NDRF-01",
        "responder_name": "Capt. A. Sharma (NDRF 4th Bn)",
        "eta_minutes": suggested_eta,
        "team_type": 1,
        "note_code": 1,  # "Stay where you are"
    })
    assert status == 200
    assert accept_json["status"] == "accepted"
    assert "signed_downlink" in accept_json
    assert accept_json["signed_downlink"]["payload_bytes_len"] == 16
    assert accept_json["signed_downlink"]["total_bytes_len"] == 80
    print("✓ 5. Responder accepted SOS, 16B Downlink payload + 64B Ed25519 signature generated (80B total)")

    # 6. Status transition: Accepted -> En Route
    status, en_route_json = req("POST", f"/api/sos/{sos_id}/status", {
        "status": "en_route",
        "eta_minutes": max(1, suggested_eta - 2),
        "note_code": 4,  # "Stay on roof / elevated structure"
    })
    assert status == 200
    assert en_route_json["status"] == "en_route"
    print(f"✓ 6. Transitioned to EN_ROUTE (ETA: {en_route_json['signed_downlink']['metadata']['eta_minutes']}m)")

    # 7. Status transition: En Route -> Arriving Soon (< 5 min)
    status, arriving_json = req("POST", f"/api/sos/{sos_id}/status", {
        "status": "arriving_soon",
        "eta_minutes": 3,
        "note_code": 3,  # "Show a light or signal"
    })
    assert status == 200
    assert arriving_json["status"] == "arriving_soon"
    print("✓ 7. Transitioned to ARRIVING_SOON")

    # 8. Status transition: Arriving Soon -> Arrived
    status, arrived_json = req("POST", f"/api/sos/{sos_id}/status", {
        "status": "arrived",
        "eta_minutes": 0,
        "note_code": 6,  # "Help is right outside"
    })
    assert status == 200
    assert arrived_json["status"] == "arrived"
    print("✓ 8. Transitioned to ARRIVED")

    # 9. Verify Downlink Message History
    status, messages = req("GET", f"/api/sos/{sos_id}/messages")
    assert status == 200
    assert len(messages) == 4  # accepted, en_route, arriving_soon, arrived
    assert messages[0]["status"] == "accepted"
    assert messages[1]["status"] == "en_route"
    assert messages[2]["status"] == "arriving_soon"
    assert messages[3]["status"] == "arrived"

    for m in messages:
        assert m["is_valid"] is True
        assert len(m["breakdown"]) == 8
    print(f"✓ 9. Downlink message history verified ({len(messages)} messages, all with valid Ed25519 signatures)")

    # 10. Victim acknowledges delivery of latest message
    latest_msg_id = messages[-1]["message_id"]
    status, ack_msg_res = req("POST", f"/api/sos/{sos_id}/messages/{latest_msg_id}/ack")
    assert status == 200
    assert ack_msg_res["status"] == "confirmed"
    print(f"✓ 10. Delivery confirmation acknowledged by victim: {latest_msg_id}")

    # 11. Test Tamper Downlink Demo
    status, tamper_data = req("POST", f"/api/demo/tamper-downlink/{sos_id}")
    assert status == 200
    assert tamper_data["status"] == "tampered"

    status, updated_history = req("GET", f"/api/sos/{sos_id}/messages")
    last_msg = updated_history[-1]
    assert last_msg["is_tampered"] is True
    assert last_msg["is_valid"] is False
    assert "REJECTED" in last_msg["verification_message"]
    print("✓ 11. Tampered downlink packet rejected with cryptographic failure!")

    print("\n==============================================")
    print("🎉 ALL MISSION LIFECYCLE TESTS PASSED (11/11)!")
    print("==============================================")


if __name__ == "__main__":
    test_full_mission_lifecycle()
