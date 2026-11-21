# RESCUE LINK Radio Packet Layout Specification

This document details the ultra-compact binary packet formats used across terrestrial LoRa (SX1276/SX1278) radio links and simulated channels in the **RESCUE LINK** off-grid disaster coordination system.

---

## 1. Uplink Distress Packet (Exactly 21 Bytes)

The victim's emergency beacon encodes critical survival telemetry into an exact 21-byte binary structure, minimizing Time-on-Air (ToA) to under 650 ms on LoRa CSS SF10 / 125 kHz.

### Binary Layout (`>B I i i B H B I` in Python `struct` syntax)

| Offset (Bytes) | Size | Data Type | Field Name | Description & Encoding |
|---|---|---|---|---|
| `0` | 1 Byte | `uint8` | **Version & Flags** | Upper 4 bits: Protocol Version (1–15). Lower 4 bits: Flags (Bit 0: `0x01` = Simulated Link, `0x00` = Real LoRa; Bit 1: Retransmission). |
| `1 – 4` | 4 Bytes | `uint32` Big-Endian | **Victim Device ID** | Unique hardware address or pseudo-random device identifier (0 to 4,294,967,295). |
| `5 – 8` | 4 Bytes | `int32` Big-Endian | **Latitude (Microdegrees)** | Latitude in degrees multiplied by $10^6$ (`int32`, range $-90.000000^\circ$ to $+90.000000^\circ$). Precision $\approx 0.11\text{ m}$. |
| `9 – 12` | 4 Bytes | `int32` Big-Endian | **Longitude (Microdegrees)** | Longitude in degrees multiplied by $10^6$ (`int32`, range $-180.000000^\circ$ to $+180.000000^\circ$). |
| `13` | 1 Byte | `uint8` | **Emergency & Severity** | Upper 4 bits: Emergency Condition Code (1–6). Lower 4 bits: Severity Level (P1=1, P2=2, P3=3, P4=4). |
| `14 – 15` | 2 Bytes | `uint16` Big-Endian | **GPS Fix Age** | Seconds elapsed since GNSS satellite fix was acquired (0 to 65,535 seconds). |
| `16` | 1 Byte | `uint8` | **People Count** | Number of trapped/affected individuals needing extraction (1 to 255). |
| `17 – 20` | 4 Bytes | `uint32` Big-Endian | **Timestamp** | Unix epoch seconds of distress transmission. |

**Total Size:** $1 + 4 + 4 + 4 + 1 + 2 + 1 + 4 = \mathbf{21\text{ Bytes}}$.

---

## 2. Downlink Acknowledgement & Mission Status Packet (16 Bytes Payload + 64 Bytes Signature)

When an authorized responder accepts or updates an SOS, the engine dispatches a compact 16-byte signed radio frame back to the victim terminal over the LoRa downlink.

### Binary Layout (`>B I B H B H I B` in Python `struct` syntax)

| Offset (Bytes) | Size | Data Type | Field Name | Description & Encoding |
|---|---|---|---|---|
| `0` | 1 Byte | `uint8` | **Version & Flags** | Upper 4 bits: Protocol Version (v1). Lower 4 bits: Flags (Bit 0: Simulated, Bit 1: Retry). |
| `1 – 4` | 4 Bytes | `uint32` Big-Endian | **Target Victim ID** | Unique Node ID matching the originating distress transmission. |
| `5` | 1 Byte | `uint8` | **Mission Status Code** | 1: Pending, 2: Accepted, 3: En Route, 4: Arriving Soon (<5 min), 5: Arrived, 6: Closed, 7: ETA Updated, 8: Cancelled. |
| `6 – 7` | 2 Bytes | `uint16` Big-Endian | **Estimated Arrival (ETA)** | Estimated time of arrival in minutes (0 to 65,535 min), calculated via Haversine distance. |
| `8` | 1 Byte | `uint8` | **Team Type** | Dispatched unit: 1: Boat (20 km/h), 2: Ambulance (40 km/h), 3: Fire & Rescue (35 km/h), 4: Helicopter (150 km/h), 5: Foot Patrol (5 km/h). |
| `9 – 10` | 2 Bytes | `uint16` Big-Endian | **Responder Authority ID** | Numeric identifier hash for the authenticated commander's public key (e.g. 1 for NDRF, 2 for SDRF). |
| `11 – 14` | 4 Bytes | `uint32` Big-Endian | **Transmission Epoch** | Unix epoch timestamp of status update. |
| `15` | 1 Byte | `uint8` | **Instruction Note Code** | Predefined mission instruction: 0: None, 1: "Stay where you are", 2: "Move to higher ground", 3: "Show a light or signal", 4: "Stay on roof / elevated structure", 5: "Conserve phone battery", 6: "Help is right outside". |
| `16 – 79` | 64 Bytes | `raw bytes` | **Ed25519 Signature** | Cryptographic digital signature of Bytes 0–15 generated using the responder's private key. |

**Total Frame Size:** $16\text{ Bytes (Payload)} + 64\text{ Bytes (Ed25519 Signature)} = \mathbf{80\text{ Bytes}}$.

---

## 3. Cryptographic Verification & Security Policy

1. **Client-Side Signature Verification**: The victim terminal maintains the public keys of authorized disaster response authorities (e.g., NDRF, SDRF). Upon receiving the 80-byte radio frame, the browser validates the Ed25519 signature over the first 16 bytes.
2. **Anti-Spoofing & Rejection**: If a single bit in the 16-byte payload or the 64-byte signature is flipped, altered, or forged by an unauthorized party, verification fails immediately.
3. **Fail-Safe UI Guarantee**: The victim terminal strictly displays **PENDING** until a valid Ed25519 digital signature is cryptographically verified. It never displays "Accepted" or false rescue assurances.
