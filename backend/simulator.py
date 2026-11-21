"""
LoRa Physical Channel Simulator

Simulates terrestrial LoRa (SX1276/SX1278) transmission characteristics:
- Carrier frequency: 868.100 MHz (Europe/India) or 915.000 MHz (US)
- Modulation: Chirp Spread Spectrum (CSS) SF10, BW 125 kHz, CR 4/5
- Programmable latency (default: 650 ms Time-on-Air + propagation)
- Programmable packet loss rate (0% - 90%)
- Realistic RF link metrics (RSSI: -75 to -115 dBm, SNR: -12 to +8 dB)
- Event logging for the demo's live 'Message Journey' timeline
- Mode switcher: 'SIMULATED' vs 'REAL_HARDWARE'
"""

import asyncio
import random
import time
from typing import Dict, Any, List, Optional
from collections import deque


class ChannelEvent:
    def __init__(self, stage: str, message: str, details: Optional[Dict[str, Any]] = None):
        self.timestamp = time.time()
        self.stage = stage  # VICTIM, LORA_TX, CHANNEL, GATEWAY_RX, IECE, DASHBOARD, RESPONDER_ACK, DOWNLINK
        self.message = message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "stage": self.stage,
            "message": self.message,
            "details": self.details,
            "time_str": time.strftime("%H:%M:%S", time.localtime(self.timestamp)),
        }


class LoRaChannelSimulator:
    """Simulates realistic LoRa link conditions."""

    def __init__(
        self,
        delay_ms: int = 650,
        packet_loss_percent: float = 0.0,
        frequency_mhz: float = 868.1,
        spreading_factor: int = 10,
        bandwidth_khz: int = 125,
        mode: str = "SIMULATED",  # 'SIMULATED' or 'REAL_HARDWARE'
    ):
        self.delay_ms = delay_ms
        self.packet_loss_percent = packet_loss_percent
        self.frequency_mhz = frequency_mhz
        self.spreading_factor = spreading_factor
        self.bandwidth_khz = bandwidth_khz
        self.mode = mode
        self.logs: deque = deque(maxlen=200)
        self.stats = {
            "packets_transmitted": 0,
            "packets_delivered": 0,
            "packets_dropped": 0,
            "downlink_delivered": 0,
        }

    def set_config(
        self,
        delay_ms: Optional[int] = None,
        packet_loss_percent: Optional[float] = None,
        mode: Optional[str] = None,
    ):
        if delay_ms is not None:
            self.delay_ms = max(50, min(5000, delay_ms))
        if packet_loss_percent is not None:
            self.packet_loss_percent = max(0.0, min(100.0, float(packet_loss_percent)))
        if mode in ("SIMULATED", "REAL_HARDWARE"):
            self.mode = mode

    def log_event(self, stage: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        evt = ChannelEvent(stage, message, details)
        self.logs.append(evt)
        return evt.to_dict()

    async def transmit_uplink(self, raw_bytes: bytes, victim_id: int) -> Dict[str, Any]:
        """Simulate transmitting a 21-byte SOS packet over LoRa."""
        self.stats["packets_transmitted"] += 1
        raw_hex = raw_bytes.hex().upper()

        # Step 1: LoRa TX event
        self.log_event(
            "LORA_TX",
            f"Transmitting 21-byte SOS packet from Node #{victim_id} over LoRa CSS",
            {
                "freq_mhz": self.frequency_mhz,
                "sf": self.spreading_factor,
                "bw_khz": self.bandwidth_khz,
                "packet_bytes": len(raw_bytes),
                "raw_hex": raw_hex,
                "link_mode": self.mode,
            },
        )

        # Step 2: Channel delay & potential packet loss
        sim_delay = (self.delay_ms / 1000.0) if self.mode == "SIMULATED" else 0.05
        # Add slight jitter (+- 15%)
        jitter = sim_delay * random.uniform(-0.15, 0.15)
        total_delay = max(0.02, sim_delay + jitter)
        await asyncio.sleep(total_delay)

        # Check packet loss
        is_dropped = random.uniform(0, 100) < self.packet_loss_percent
        if is_dropped:
            self.stats["packets_dropped"] += 1
            self.log_event(
                "CHANNEL",
                f"Packet DROPPED due to simulated channel interference ({self.packet_loss_percent}% loss rate)",
                {"victim_id": victim_id, "simulated_loss": True},
            )
            return {
                "delivered": False,
                "dropped": True,
                "reason": f"Simulated RF packet loss ({self.packet_loss_percent}%)",
                "time_on_air_ms": round(total_delay * 1000),
            }

        # Step 3: Gateway Reception
        rssi = round(random.uniform(-108.0, -82.0), 1)
        snr = round(random.uniform(-4.0, 9.5), 1)
        self.stats["packets_delivered"] += 1

        self.log_event(
            "GATEWAY_RX",
            f"SX1276 LoRa Gateway received 21 bytes (RSSI: {rssi} dBm, SNR: {snr} dB, CRC: OK)",
            {
                "victim_id": victim_id,
                "rssi_dbm": rssi,
                "snr_db": snr,
                "crc": "VALID",
                "time_on_air_ms": round(total_delay * 1000),
                "link_mode": self.mode,
            },
        )

        return {
            "delivered": True,
            "dropped": False,
            "rssi_dbm": rssi,
            "snr_db": snr,
            "time_on_air_ms": round(total_delay * 1000),
            "raw_hex": raw_hex,
            "link_mode": self.mode,
        }

    async def transmit_downlink_ack(self, signed_ack: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate transmitting signed ack back to victim via LoRa downlink."""
        sim_delay = (self.delay_ms / 1000.0) if self.mode == "SIMULATED" else 0.05
        await asyncio.sleep(sim_delay)

        self.stats["downlink_delivered"] += 1
        sos_id = signed_ack.get("payload", {}).get("sos_id", "UNKNOWN")
        responder = signed_ack.get("payload", {}).get("responder_name", "Responder")

        self.log_event(
            "DOWNLINK",
            f"Signed Ack delivered to victim terminal for {sos_id} from {responder}",
            {
                "sos_id": sos_id,
                "algorithm": signed_ack.get("algorithm", "Ed25519"),
                "signature_preview": signed_ack.get("signature_hex", "")[:16] + "...",
                "link_mode": self.mode,
            },
        )
        return {"delivered": True, "downlink_latency_ms": round(sim_delay * 1000)}

    async def transmit_downlink_message(
        self,
        downlink_bytes: bytes,
        signed_msg: Dict[str, Any],
        victim_id: int,
        attempt: int = 1,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Simulate transmitting signed compact 16B downlink message back to victim via LoRa.
        Handles propagation delay, simulated channel loss, and retry attempts.
        """
        sim_delay = (self.delay_ms / 1000.0) if self.mode == "SIMULATED" else 0.05
        jitter = sim_delay * random.uniform(-0.1, 0.1)
        total_delay = max(0.02, sim_delay + jitter)
        await asyncio.sleep(total_delay)

        # Check packet loss
        is_dropped = (random.uniform(0, 100) < self.packet_loss_percent) if self.mode == "SIMULATED" else False
        status_label = signed_msg.get("status_label", signed_msg.get("status", "Update"))
        sos_id = signed_msg.get("sos_id", f"SOS-{victim_id}")

        if is_dropped:
            self.stats["packets_dropped"] += 1
            self.log_event(
                "DOWNLINK",
                f"Downlink message for {sos_id} DROPPED by RF interference (Attempt {attempt}/{max_retries}, {self.packet_loss_percent}% loss rate)",
                {
                    "sos_id": sos_id,
                    "victim_id": victim_id,
                    "attempt": attempt,
                    "status": signed_msg.get("status"),
                    "delivered": False,
                    "retry_queued": attempt < max_retries,
                },
            )
            return {
                "delivered": False,
                "dropped": True,
                "attempt": attempt,
                "time_on_air_ms": round(total_delay * 1000),
                "retry_queued": attempt < max_retries,
            }

        self.stats["downlink_delivered"] += 1
        self.stats["packets_delivered"] += 1
        self.log_event(
            "DOWNLINK",
            f"Signed Downlink '{status_label}' delivered to Node #{victim_id} (Attempt {attempt}/{max_retries}, {len(downlink_bytes)}B payload + 64B Ed25519 sig)",
            {
                "sos_id": sos_id,
                "victim_id": victim_id,
                "status": signed_msg.get("status"),
                "eta_minutes": signed_msg.get("eta_minutes"),
                "attempt": attempt,
                "delivered": True,
                "time_on_air_ms": round(total_delay * 1000),
                "raw_downlink_hex_preview": signed_msg.get("raw_downlink_hex", "")[:24] + "...",
            },
        )
        return {
            "delivered": True,
            "dropped": False,
            "attempt": attempt,
            "time_on_air_ms": round(total_delay * 1000),
        }


    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "is_simulated": self.mode == "SIMULATED",
            "delay_ms": self.delay_ms,
            "packet_loss_percent": self.packet_loss_percent,
            "frequency_mhz": self.frequency_mhz,
            "spreading_factor": self.spreading_factor,
            "bandwidth_khz": self.bandwidth_khz,
            "stats": self.stats,
            "recent_events": [e.to_dict() for e in list(self.logs)[-20:]],
        }


lora_simulator = LoRaChannelSimulator()
