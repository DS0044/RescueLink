# RESCUE LINK 🛰️🚨
### Offline Emergency Communication & Coordination Prototype
**Hackathon: ASTRA | Domain: Satellite Communication, Navigation and Connectivity**

---

## 📌 Executive Summary & Scenario

During severe natural disasters (floods, cyclones, earthquakes), cellular towers collapse, leaving victims isolated in dark zones. **RESCUE LINK** is an offline emergency communication and coordination engine that enables trapped victims to transmit survival telemetry without cellular networks or internet access.

### 🎬 Scenario Demonstrated Live to Evaluators:
1. **Victim in Flood Basin**: Trapped with zero cellular coverage. The victim initiates an SOS on the terminal.
2. **IECE Binary Packing**: The emergency condition, people count, GNSS coordinates, and fix age are compressed into an exact **21-byte compact struct** (`>B I i i B H B I`).
3. **LoRa Uplink Transmission**: The 21-byte binary packet is transmitted over a low-power LoRa channel (868.1 MHz, CSS SF10 BW125).
4. **IECE Processing Engine**:
   - **Triage Priority Preemption**: Life-threatening conditions (e.g. cardiac arrest P1) preempt the queue ahead of non-critical reports (P3/P4).
   - **Spatial Cluster Grouping**: Reports within a 50-meter radius sharing an emergency condition are auto-grouped into an aggregated cluster card (*"7 people need assistance here"*), preventing dispatch fragmentation.
5. **Rescue Dashboard Map & Location Selection**:
   - Incidents appear in real-time on an interactive Leaflet dashboard with color-coded priority markers and grouped count badges.
   - Clicking an incident in the list or on the map smoothly flies the camera to the victim's location, highlights the marker with a pulsing ring, dims other markers, draws an **accuracy/uncertainty circle** scaling with GPS age, and displays an offline direct vector line from the rescue base station.
6. **Authorized Responder Triage & Acceptance**:
   - An authenticated disaster commander (e.g. *Capt. A. Sharma, NDRF 4th Battalion*) accepts the rescue mission.
   - The commander selects the deployment team type (Boat, Ambulance, Fire/Rescue, Helicopter, Foot patrol).
   - The engine auto-calculates the estimated arrival time (**ETA in minutes**) using the **Haversine formula** based on straight-line distance and team speed.
7. **Compact Signed Downlink Message (16B + 64B Ed25519)**:
   - The backend builds an ultra-compact **16-byte downlink frame** (`>B I B H B H I B`) containing status code, ETA, team type, and instruction note code.
   - An asymmetric digital signature (64 bytes) is appended using the commander's Ed25519 private key (total 80 bytes).
8. **Live Mission Lifecycle Updates to Victim**:
   - The victim terminal independently verifies the Ed25519 signature before displaying: *"Help accepted by Boat Rescue Team (Capt. A. Sharma). Estimated arrival: 12 min."*
   - As the mission advances, the responder sends signed updates through the state machine: **En Route** &rarr; **Arriving Soon (&lt;5 min)** &rarr; **Arrived**.
   - The victim terminal maintains a live countdown timer marked *(estimated)*, sounds gentle Web Audio alert chimes, triggers haptic vibrations, and displays commander instruction notes.
   - If an acknowledgement is forged or tampered with, the terminal actively rejects it and remains in **Pending** status.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Victim["Victim Emergency Terminal"]
        V1["Victim SOS Interface<br/>(Emergency Type + People + GNSS)"] --> V2["Browser Geolocation / Manual Fallback"]
        V2 --> V3["IECE 21-Byte Packet Encoder"]
    end

    subgraph Channel["LoRa Physical / Simulation Layer"]
        V3 -->|"Uplink (868.1 MHz, SF10, 21 Bytes)"| L1["LoRa Channel (SX1276 / Simulated)"]
        L1 -->|"Time-on-Air (650ms) + Loss Sim"| G1["LoRa Gateway Receiver"]
    end

    subgraph Backend["RescueLink IECE Core Backend (FastAPI + SQLite)"]
        G1 -->|"Hex Payload"| B1["IECE Packet Decoder & Inspector"]
        B1 --> B2["IECE Priority Queue (P1 > P2 > P3 > P4 FIFO)"]
        B1 --> B3["IECE Duplicate Grouper (Haversine <50m)"]
        B2 --> B4["Database & WebSocket Broadcast Feed"]
        B3 --> B4
    end

    subgraph Dashboard["Rescue Command Dashboard (React + Leaflet)"]
        B4 -->|"Live WebSocket"| D1["Interactive OpenStreetMap & Offline Grid"]
        D1 --> D2["Selection: FlyTo + Pulsing Ring + Uncertainty Circle"]
        D1 --> D3["Location Panel: Monospace Coords + Bearing + GPX Export"]
    end

    subgraph Responder["Authorized Commander Authentication"]
        D3 --> R1["Authorized Responder Login"]
        R1 -->|"Accept SOS with Haversine ETA"| R2["Mission State Machine (En Route > Arriving > Arrived)"]
        R2 --> R3["Ed25519 Digital Signer (Private Key)"]
    end

    subgraph Downlink["Verified Acknowledgement Downlink (80 Bytes)"]
        R3 -->|"16B Downlink Payload + 64B Ed25519 Sig"| L2["LoRa Downlink Transmission"]
        L2 --> V4["Victim Terminal Client-Side Verification"]
        V4 -->|"Signature Valid"| V5["'Help Accepted: ETA Countdown + Live Updates'"]
        V4 -->|"Signature Invalid (Tampered)"| V6["'FORGED MESSAGE REJECTED'"]
    end
```

---

## ⚖️ Honesty Disclosure: What is Real vs. Simulated

In compliance with the hackathon rules and honest engineering practices:

| Subsystem | Demo Status | Technical Implementation Details |
|---|---|---|
| **IECE 21-Byte Uplink Packet** | **100% REAL** | Exact binary `struct` (`>B I i i B H B I`), microdegree coordinates, bitwise nibble packing for emergency type and severity. Zero JSON overhead over the air. |
| **IECE 16-Byte Downlink Packet** | **100% REAL** | Compact binary `struct` (`>B I B H B H I B`) with status codes, team types, ETA minutes, and instruction note codes. |
| **Ed25519 Cryptographic Signatures** | **100% REAL** | Asymmetric Ed25519 keypairs. Responders sign with private keys; browser client independently verifies using `@noble/ed25519` and Web Crypto API. |
| **Haversine Distance & ETA Engine** | **100% REAL** | Great Circle distance calculation against rescue base station with deployment speeds (Boat 20 km/h, Ambulance 40 km/h, Fire 35 km/h, Heli 150 km/h, Foot 5 km/h). |
| **Map Selection & Uncertainty Circle** | **100% REAL** | Smooth `flyTo`, pulsing highlight ring, 40% background dimming, dynamic accuracy circle scaling with GPS age, compass bearing calculation, and GPX/KML waypoint generation. |
| **LoRa Physical Channel** | **SOFTWARE SIMULATED** | Includes realistic Time-on-Air (650ms), adjustable packet loss (0-80%), jitter, and synthetic RSSI/SNR metrics. *(Labeled with **SIMULATED LINK** badge)*. |
| **Physical Hardware Gateway** | **SUPPORTED** | Optional ESP32 + Semtech SX1276 firmware (C++) and Python USB serial bridge are included in `firmware/`. |
| **Direct Satellite Link** | **ROADMAP / FUTURE** | HANDHELD DIRECT SATELLITE COMMS IS NOT YET IMPLEMENTED. Handheld nodes communicate over terrestrial LoRa to gateways. Gateway satellite backhaul (Astrocast/Iridium/NavIC) is modeled for future isolated mesh deployments. |

---

## 📦 Packet Binary Layouts

### Uplink Packet (21 Bytes)
Detailed specification in [docs/PACKET_FORMAT.md](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/PACKET_FORMAT.md).
- Format: `>B I i i B H B I`
- 1B Version/Flags, 4B Victim ID, 4B Latitude (microdegrees), 4B Longitude (microdegrees), 1B Type+Severity, 2B GPS Fix Age, 1B People Count, 4B Timestamp.

### Downlink Acknowledgement & Status Packet (80 Bytes)
Detailed specification in [docs/PACKET_FORMAT.md](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/PACKET_FORMAT.md).
- Payload (16 Bytes): `>B I B H B H I B`
  - 1B Version/Flags, 4B Victim ID, 1B Status Code, 2B ETA (minutes), 1B Team Type, 2B Responder ID, 4B Timestamp, 1B Instruction Note Code.
- Signature (64 Bytes): Asymmetric Ed25519 signature over Bytes 0–15.

---

## 🚀 Quickstart & Demo Walkthrough

### 1. Requirements
- Python 3.10+
- Node.js 18+

### 2. Run Application
```bash
# Start backend server
.\venv\Scripts\python -m uvicorn main:app --app-dir backend --port 8000 --host 0.0.0.0
```

### 3. Open Web Pages
- 🏠 **Landing Page**: [http://localhost:8000/](http://localhost:8000/)
- 🚨 **Victim SOS Terminal**: [http://localhost:8000/victim](http://localhost:8000/victim) *(100% public, no login required)*
- 🔑 **Responder Sign In**: [http://localhost:8000/login](http://localhost:8000/login)
- 📝 **Access Request**: [http://localhost:8000/register](http://localhost:8000/register)
- 🗺️ **Rescue Dashboard & Map**: [http://localhost:8000/dashboard](http://localhost:8000/dashboard) *(Requires Responder+ session)*
- 👥 **Admin User Management**: [http://localhost:8000/admin/users](http://localhost:8000/admin/users) *(Requires Admin session)*
- 🧪 **Demo Control Center**: [http://localhost:8000/demo](http://localhost:8000/demo)

---

## 🔐 Authentication, Authorization (RBAC) & Session Protection

RescueLink incorporates an enterprise disaster command authentication model separating distressed victims from verified rescue responders:

### 1. Role-Based Access Control (RBAC)
- **Victim (Public)**: Submits distress packets (`POST /api/sos`) and receives verified downlinks (`GET /api/sos/{id}/messages`). Never blocked by login barriers.
- **Responder**: Views live tactical map, inspects SOS telemetry, accepts assignments, and broadcasts signed mission lifecycle updates.
- **Coordinator**: All Responder rights + Manual AI triage priority override (`POST /api/sos/{id}/override`) and team reassignment.
- **Administrator**: All Coordinator rights + User approval/rejection, role management, offline temporary password recovery, and access to immutable security audit logs (`/admin/users`).

### 2. Evaluator Demo Credentials
| Role | Username | Password | Access Scope |
|---|---|---|---|
| **Admin** | `admin` | `RescueAdmin@2026!` | Full dashboard + Admin console + Audit logs |
| **Coordinator** | `coordinator_rao` | `RescueCoord@2026!` | Dashboard + Priority override + Dispatch |
| **Responder** | `responder_singh` | `RescueResp@2026!` | Dashboard + SOS acceptance + Mission updates |
| **Pending Volunteer** | `volunteer_kiran` | `RescueVolunteer@2026!` | Pending approval (Login blocked with prompt) |

### 3. Cryptographic Session & Token Architecture
- **Password Storage**: Passwords salted and hashed with `bcrypt` (work factor rounds=12).
- **Dual-Token System**:
  - **Access Token**: Short-lived JWT (15 minutes), passed via `Authorization: Bearer` or HttpOnly cookie.
  - **Refresh Token**: Long-lived secure token (7 days; 30 days with "Remember Me") with cryptographic rotation and database revocation.
- **Brute-Force Lockout**: 5 consecutive failed attempts trigger account lockout (5 minutes, doubling on repeated failures). Identical timing-safe response for non-existent users and incorrect passwords.
- **Inactivity Warning**: Auto-logout after 30 minutes of inactivity with a warning countdown modal at minute 29.
- **Protected WebSockets**: Real-time channel `/ws/dashboard` validates token on handshake and terminates with code 4401 on revocation.
- **Offline Password Recovery**: For disaster zones cut off from external mail servers, Admins generate a one-time temporary password (`TempRescue!XXXX`) enforcing `must_change_password=True`.

### 4. Prototype Disclosure: Prototype vs. Full Production
In adherence to realistic engineering standards:
- **Implemented in Prototype**: Bcrypt password hashing, JWT dual-token rotation, HttpOnly cookies, RBAC route guards, IP rate-limiting, account lockout, offline temporary password reset, security audit logging, and security response headers (CSP, X-Frame-Options, X-Content-Type-Options).
- **Required for Full Production Deployment**: HTTPS/TLS termination with HSTS, Hardware Security Modules (HSM) or cloud KMS for signing keys, Hardware-bound multi-factor authentication (FIDO2/WebAuthn), and out-of-band identity vetting for government emergency responders.

---

## 📸 Feature Screenshots & Visual Deliverables

All high-resolution responsive screenshots are available in [docs/design/](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/):

### Authentication & Access Control
| Feature View | Screenshot File |
|---|---|
| **Responder Sign In** | [auth_login_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_login_page.png) |
| **Uniform Error / Account Lockout** | [auth_login_error_state.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_login_error_state.png) |
| **Access Request & Password Strength** | [auth_register_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/auth_register_page.png) |
| **Header User Menu & Account Actions** | [dashboard_header_user_menu.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_header_user_menu.png) |
| **Admin User Management & Audit Logs** | [admin_user_management_page.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/admin_user_management_page.png) |

### Rescue Dashboard Selection & Location Vectoring
| Feature View | Screenshot File |
|---|---|
| **Selected SOS Marker & Live Popup** | [dashboard_selected_request_popup.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_selected_request_popup.png) |
| **Detail Drawer Location & Export Panel** | [dashboard_drawer_location_section.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_drawer_location_section.png) |
| **Clustered Group View & Sub-Victims** | [dashboard_group_view.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_group_view.png) |
| **Offline Tactical Grid Canvas Fallback** | [dashboard_offline_fallback.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/dashboard_offline_fallback.png) |

### Nearest Radio Tower Propagation & Selection Simulation
| Simulation Step / View | Screenshot File |
|---|---|
| **Step 2: Radar Pulse & Tower Scanning** | [tower_sim_step2_scanning.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/tower_sim_step2_scanning.png) |
| **Step 4: Nearest In-Service Tower Selection (-98 dBm)** | [tower_sim_step4_selected.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/tower_sim_step4_selected.png) |
| **Step 7: SOS Delivered to Rescue Gateway** | [tower_sim_step7_delivered.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/tower_sim_step7_delivered.png) |
| **Mobile Viewport (360px Responsive)** | [tower_sim_mobile_360px.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/tower_sim_mobile_360px.png) |

### Victim Terminal Mission Lifecycle & Cryptographic Verification
| State | Screenshot File |
|---|---|
| **Accepted by Responder (ETA 12m)** | [victim_status_accepted.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/victim_status_accepted.png) |
| **En Route (Live Countdown Timer)** | [victim_status_enroute.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/victim_status_enroute.png) |
| **Forged Message Rejected (Tamper Alert)** | [victim_tamper_rejected.png](file:///c:/Users/dd961/OneDrive/Desktop/RescueLink/docs/design/victim_tamper_rejected.png) |

---

## 🧪 Automated Test Verification

Run all test suites locally:
```bash
# Unit tests for downlink encoding, Ed25519 crypto, and state transitions
.\venv\Scripts\python backend/tests/test_downlink_packet.py

# End-to-end integration lifecycle test suite (11/11 checks)
.\venv\Scripts\python backend/tests/test_mission_lifecycle.py

# Complete Authentication, RBAC, Rate-Limiting & Audit Log suite (10/10 checks)
.\venv\Scripts\python backend/tests/test_auth_rbac.py
```
