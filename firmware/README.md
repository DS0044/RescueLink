# RESCUE LINK Hardware Firmware & Gateway Bridge

This directory contains optional PlatformIO / Arduino C++ firmware to run RescueLink on physical ESP32 microcontrollers with Semtech SX1276 / SX1278 LoRa transceivers and GPS/GNSS receivers.

---

## 1. Hardware Pinout Wiring

### ESP32 to Semtech SX1276 (SPI)
| SX1276 Pin | ESP32 GPIO | Description |
|---|---|---|
| **VCC** | 3.3V | Power (Do NOT use 5V) |
| **GND** | GND | Ground |
| **SCK** | GPIO 18 | SPI Clock |
| **MISO** | GPIO 19 | SPI MISO |
| **MOSI** | GPIO 23 | SPI MOSI |
| **NSS / CS** | GPIO 5 | Chip Select |
| **RST** | GPIO 14 | Reset |
| **DIO0** | GPIO 2 | RxDone / TxDone Interrupt |

### ESP32 to GNSS Module (NEO-6M / NEO-M8N / NavIC)
| GPS Module Pin | ESP32 GPIO | Description |
|---|---|---|
| **VCC** | 3.3V or 5V | Power supply |
| **GND** | GND | Ground |
| **TX** | GPIO 16 (RX2) | NMEA Serial Rx on ESP32 |
| **RX** | GPIO 17 (TX2) | Serial Tx on ESP32 |

---

## 2. Flashing the Transmitter Node (`esp32_lora_sender`)
1. Connect victim ESP32 to your PC.
2. Open `firmware/esp32_lora_sender` in VS Code with PlatformIO.
3. Build and upload:
   ```bash
   pio run --target upload
   ```
4. Pressing the on-board **BOOT button** transmits the exact 21-byte binary packet over 868.1 MHz.

---

## 3. Flashing the Gateway Node (`esp32_lora_gateway`)
1. Connect gateway ESP32 to your PC via USB.
2. Open `firmware/esp32_lora_gateway` in PlatformIO.
3. Build and upload:
   ```bash
   pio run --target upload
   ```
4. The gateway listens for incoming 21-byte packets and writes JSON lines with RSSI and SNR to USB serial.

---

## 4. Running the Python Serial Bridge
Forward packets from the USB gateway directly into the RescueLink backend:
```bash
pip install pyserial
python firmware/serial_bridge.py --port COM3 --baud 115200 --api http://localhost:8000
```
On Linux / macOS:
```bash
python firmware/serial_bridge.py --port /dev/ttyUSB0 --baud 115200 --api http://localhost:8000
```
