"""Seed development & evaluation responder accounts into database."""

import os
import sys
import time
from dotenv import load_dotenv

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db
from models import UserModel
from auth import hash_password, log_audit

load_dotenv()

ADMIN_PW = os.getenv("DEMO_ADMIN_PASSWORD", "RescueAdmin@2026!")
COORD_PW = os.getenv("DEMO_COORDINATOR_PASSWORD", "RescueCoord@2026!")
RESP_PW = os.getenv("DEMO_RESPONDER_PASSWORD", "RescueResp@2026!")
PEND_PW = os.getenv("DEMO_PENDING_PASSWORD", "RescueVolunteer@2026!")


def seed_demo_users():
    init_db()
    db = SessionLocal()
    now = int(time.time())

    users = [
        {
            "id": "USR-ADMIN-01",
            "name": "Capt. A. Sharma",
            "username": "admin",
            "email": "admin@ndrf.gov.in",
            "password_hash": hash_password(ADMIN_PW),
            "role": "admin",
            "status": "active",
            "organisation": "NDRF 4th Battalion (Operations Commander)",
            "created_at": now - 86400 * 30,
            "last_login": now - 3600,
            "must_change_password": False,
        },
        {
            "id": "USR-COORD-02",
            "name": "Inspector M. Rao",
            "username": "coordinator_rao",
            "email": "m.rao@sdrf.gov.in",
            "password_hash": hash_password(COORD_PW),
            "role": "coordinator",
            "status": "active",
            "organisation": "SDRF Disaster Response Center",
            "created_at": now - 86400 * 20,
            "last_login": now - 7200,
            "must_change_password": False,
        },
        {
            "id": "USR-RESP-03",
            "name": "Havildar D. Singh",
            "username": "responder_singh",
            "email": "d.singh@ndrf.gov.in",
            "password_hash": hash_password(RESP_PW),
            "role": "responder",
            "status": "active",
            "organisation": "NDRF Flood Evacuation Unit 1",
            "created_at": now - 86400 * 10,
            "last_login": now - 1800,
            "must_change_password": False,
        },
        {
            "id": "USR-PEND-04",
            "name": "Kiran Kumar",
            "username": "volunteer_kiran",
            "email": "kiran@chennaiaid.org",
            "password_hash": hash_password(PEND_PW),
            "role": "responder",
            "status": "pending",
            "organisation": "Local NGO Disaster Relief Volunteers",
            "created_at": now - 3600 * 2,
            "last_login": None,
            "must_change_password": False,
        },
    ]

    print("[*] Seeding demo responder and admin accounts...")
    for u in users:
        existing = db.query(UserModel).filter((UserModel.username == u["username"]) | (UserModel.email == u["email"])).first()
        if existing:
            # Update password and role
            existing.name = u["name"]
            existing.password_hash = u["password_hash"]
            existing.role = u["role"]
            existing.status = u["status"]
            existing.organisation = u["organisation"]
            existing.failed_attempts = 0
            existing.locked_until = 0
            print(f"    [=] Updated existing account: '{u['username']}' (Role: {u['role']}, Status: {u['status']})")
        else:
            db.add(UserModel(**u))
            print(f"    [+] Created account: '{u['username']}' (Role: {u['role']}, Status: {u['status']})")

    db.commit()
    log_audit(db, "system_seed_users", details="Seeded demo user accounts for evaluation")
    db.close()
    print("[+] Demo user seeding complete! Passwords loaded securely from backend/.env")


if __name__ == "__main__":
    seed_demo_users()
