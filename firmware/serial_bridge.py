"""
RescueLink Hardware Serial Bridge
Bridges the physical ESP32 LoRa Gateway to the FastAPI backend API.
Reads 21-byte hex packets from USB Serial and forwards them via HTTP POST.
"""

import sys
import time
import json
import argparse
import urllib.request

try:
    import serial
except ImportError:
    print("[!] pyserial not found. Install with: pip install pyserial")
    serial = None


def forward_uplink(raw_hex: str, rssi: float = None, snr: float = None, api_url: str = "http://127.0.0.1:8000"):
    payload = {
        "raw_hex": raw_hex,
        "rssi_dbm": rssi,
        "snr_db": snr,
    }
    req = urllib.request.Request(
        f"{api_url}/api/lora/uplink",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"[+] Forwarded to backend -> Assigned Packet ID: {data.get('packet_id')}")
    except Exception as e:
        print(f"[-] Backend forward failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="RescueLink ESP32 LoRa to Backend Serial Bridge")
    parser.add_argument("--port", default="COM3", help="Serial port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="RescueLink API base URL")
    args = parser.parse_args()

    if not serial:
        print("Please install pyserial: pip install pyserial")
        sys.exit(1)

    print(f"Connecting to ESP32 Gateway on {args.port} @ {args.baud} baud...")
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
    except Exception as e:
        print(f"Failed to open port {args.port}: {e}")
        sys.exit(1)

    print("[+] Bridge active. Listening for RESCUELINK_UPLINK packets...")
    while True:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue

            print(f"[SERIAL] {line}")
            if "RESCUELINK_UPLINK:" in line:
                json_part = line.split("RESCUELINK_UPLINK:")[1].strip()
                parsed = json.loads(json_part)
                raw_hex = parsed.get("raw_hex")
                rssi = parsed.get("rssi_dbm")
                snr = parsed.get("snr_db")
                if raw_hex and len(raw_hex) == 42:
                    forward_uplink(raw_hex, rssi, snr, args.api)
        except KeyboardInterrupt:
            print("\nStopping bridge.")
            break
        except Exception as e:
            print(f"[-] Error: {e}")


if __name__ == "__main__":
    main()
