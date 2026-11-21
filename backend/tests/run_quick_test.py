import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

import asyncio
import httpx
from main import app
from database import init_db

init_db()

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/health")
        print("Health check:", r.status_code, r.json())
        assert r.status_code == 200

        r = await client.get("/api/sos/list")
        print("SOS list count:", len(r.json()))
        assert r.status_code == 200

        # Test sending an SOS
        payload = {
            "victim_id": 9999,
            "latitude": 13.0827,
            "longitude": 80.2707,
            "emergency_type": 1,
            "people_count": 2,
            "is_simulated": True,
        }
        r = await client.post("/api/sos/send", json=payload)
        print("Send SOS:", r.status_code, r.json()["packet_id"])
        assert r.status_code == 200

        pkt_id = r.json()["packet_id"]
        # Accept SOS
        r_accept = await client.post(f"/api/sos/{pkt_id}/accept", json={"responder_id": "RESP-NDRF-01"})
        print("Accept SOS:", r_accept.status_code, r_accept.json()["status"])
        assert r_accept.status_code == 200

        # Check Ack
        r_ack = await client.get(f"/api/sos/{pkt_id}/ack")
        print("Victim Ack:", r_ack.status_code, r_ack.json()["accepted"])
        assert r_ack.json()["accepted"] is True

    print("ALL ASYNC API INTEGRATION CHECKS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
