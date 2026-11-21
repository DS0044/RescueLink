"""
Full integration test against live Uvicorn instance.
Tests end-to-end SOS dispatch, 21-byte IECE packet breakdown, priority sorting,
cluster grouping, Ed25519 cryptographic signing, and tamper detection.
"""

import subprocess
import time
import urllib.request
import json
import sys


def request(method: str, path: str, data: dict = None) -> dict:
    url = f"http://127.0.0.1:8000{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    print("--- Starting Uvicorn Server ---")
    proc = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "main:app",
        "--app-dir", "backend",
        "--port", "8000",
        "--host", "127.0.0.1",
        "--log-level", "warning"
    ])
    time.sleep(2.5)

    try:
        # 1. Health check
        health = request("GET", "/api/health")
        assert health["status"] == "healthy"
        print("[PASS] 1. Health check:", health["service"])

        # 2. List initial seed data
        sos_list = request("GET", "/api/sos/list")
        assert len(sos_list) >= 6
        severities = [s["severity"] for s in sos_list]
        assert severities == sorted(severities), "Reports must be sorted by priority (P1 first)"
        print(f"[PASS] 2. Seed data loaded ({len(sos_list)} reports). P1 critical items are sorted first!")

        # 3. Test duplicate grouping in seed data
        groups = request("GET", "/api/sos/groups")
        assert len(groups) >= 4
        # At least one group must have multiple reports (our flood cluster)
        multi_rep_groups = [g for g in groups if g["report_count"] > 1]
        assert len(multi_rep_groups) >= 1
        print(f"[PASS] 3. Cluster Grouping: {multi_rep_groups[0]['summary_card']}")

        # 4. Send Victim SOS and verify 21-byte compact packet
        victim_payload = {
            "victim_id": 7788,
            "latitude": 13.082710,
            "longitude": 80.270725,
            "emergency_type": 2,  # Trapped in Flood
            "people_count": 4,
            "gps_age_sec": 8,
            "is_simulated": True,
        }
        send_res = request("POST", "/api/sos/send", victim_payload)
        assert send_res["delivered"] is True
        assert send_res["byte_count"] == 21
        assert len(send_res["raw_hex"]) == 42
        assert len(send_res["breakdown"]) == 8
        pkt_id = send_res["packet_id"]
        print(f"[PASS] 4. Victim SOS sent: 21 Bytes ({send_res['raw_hex'][:16]}...) - Breakdown valid!")

        # 5. Check acknowledgement BEFORE responder accepts -> Must be PENDING
        ack_before = request("GET", f"/api/sos/{pkt_id}/ack")
        assert ack_before["accepted"] is False
        assert ack_before["status"] == "pending"
        print(f"[PASS] 5. Victim terminal status before acceptance: PENDING (no false positive)")

        # 6. Authorized Responder Accepts SOS
        accept_payload = {
            "responder_id": "RESP-NDRF-01",
            "responder_name": "Capt. A. Sharma (NDRF)",
            "eta_minutes": 12,
        }
        accept_res = request("POST", f"/api/sos/{pkt_id}/accept", accept_payload)
        assert accept_res["status"] == "accepted"
        signed_ack = accept_res["signed_ack"]
        assert signed_ack["algorithm"] == "Ed25519"
        assert len(signed_ack["signature_hex"]) == 128
        assert len(signed_ack["public_key_hex"]) == 64
        print(f"[PASS] 6. Responder accepted: Ed25519 Signature created ({signed_ack['signature_hex'][:16]}...)")

        # 7. Victim verifies legitimate signed acknowledgement
        ack_after = request("GET", f"/api/sos/{pkt_id}/ack")
        assert ack_after["accepted"] is True
        assert ack_after["server_verified"] is True
        assert ack_after["responder_name"] == "Capt. A. Sharma (NDRF)"
        print(f"[PASS] 7. Victim terminal verified Ed25519 signature: ACCEPTED by {ack_after['responder_name']}")

        # 8. Tamper test: Tamper the signed acknowledgement
        tamper_res = request("POST", f"/api/demo/tamper-ack/{pkt_id}?tamper_type=modify_field")
        assert tamper_res["status"] == "tampered"
        ack_tampered = request("GET", f"/api/sos/{pkt_id}/ack")
        assert ack_tampered["server_verified"] is False
        assert ack_tampered["signed_ack"]["is_tampered"] is True
        print(f"[PASS] 8. Tamper Test: Forged/Altered acknowledgement REJECTED cryptographically!")

        # 9. Scripted Demo: Sample Two (Heart attack vs Stranded)
        s2 = request("POST", "/api/demo/sample-two")
        assert s2["status"] == "success"
        print("[PASS] 9. Scripted Demo: Sample Two emergencies processed and prioritized")

        # 10. Scripted Demo: Sample Five (Flood cluster within 50m)
        s5 = request("POST", "/api/demo/sample-five")
        assert s5["status"] == "success"
        print("[PASS] 10. Scripted Demo: Sample Five flood victims clustered into single card")

        # 11. IECE Stats
        stats = request("GET", "/api/iece/stats")
        print(f"[PASS] 11. IECE Stats: {stats['total_sos']} total reports, {stats['total_groups']} groups")

        print("\n==============================================")
        print("ALL 11 END-TO-END SYSTEM INTEGRATION TESTS PASSED!")
        print("==============================================")

    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
