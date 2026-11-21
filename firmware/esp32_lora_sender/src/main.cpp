/**
 * RescueLink ESP32 LoRa Sender & GNSS Beacon
 * Encodes emergency telemetry into the exact 21-byte IECE binary packet
 * and broadcasts over 868.1MHz / 915MHz using SX1276 / SX1278.
 */

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <TinyGPS++.h>

// Hardware Pin Definitions (ESP32 TTGO / Heltec / Custom ESP32+SX1276)
#define LORA_SCK     18
#define LORA_MISO    19
#define LORA_MOSI    23
#define LORA_SS      5
#define LORA_RST     14
#define LORA_DIO0    2

#define LORA_BAND    868.1E6 // 868.1 MHz (India/EU) or 915E6 (US)
#define SPREADING_FACTOR 10  // SF10 for high range
#define SIGNAL_BANDWIDTH 125E3 // 125 kHz
#define CODING_RATE  5       // 4/5

#define GPS_RX_PIN   16
#define GPS_TX_PIN   17
#define GPS_BAUD     9600

#define SOS_BUTTON_PIN 0     // On-board Boot button triggers emergency

// IECE 21-Byte Binary Struct Layout (Packed, Big-Endian)
#pragma pack(push, 1)
struct IECEPacket {
    uint8_t  version_flags;       // upper 4b: ver (1), lower 4b: flags (0=real LoRa)
    uint32_t victim_id;           // Node ID (big-endian)
    int32_t  lat_micro;           // latitude * 1e6
    int32_t  lon_micro;           // longitude * 1e6
    uint8_t  emergency_severity;  // upper 4b: em_type (2=Flood), lower 4b: severity (2=P2)
    uint16_t gps_age_sec;         // seconds since fix
    uint8_t  people_count;        // people needing extraction
    uint32_t timestamp;           // epoch seconds
};
#pragma pack(pop)

static_assert(sizeof(IECEPacket) == 21, "IECEPacket must be exactly 21 bytes!");

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

const uint32_t VICTIM_DEVICE_ID = 1001;

// Helper to convert host to network byte order (big endian)
uint32_t hton32(uint32_t val) {
    return ((val & 0xFF000000) >> 24) |
           ((val & 0x00FF0000) >> 8)  |
           ((val & 0x0000FF00) << 8)  |
           ((val & 0x000000FF) << 24);
}

uint16_t hton16(uint16_t val) {
    return ((val & 0xFF00) >> 8) | ((val & 0x00FF) << 8);
}

void setup() {
    Serial.begin(115200);
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

    Serial.println(F("[RESCUE LINK] Booting ESP32 LoRa Transmitter..."));

    // Initialize SPI and LoRa
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

    if (!LoRa.begin(LORA_BAND)) {
        Serial.println(F("[-] LoRa init failed! Check wiring."));
        while (1) { delay(1000); }
    }

    LoRa.setSpreadingFactor(SPREADING_FACTOR);
    LoRa.setSignalBandwidth(SIGNAL_BANDWIDTH);
    LoRa.setCodingRate4(CODING_RATE);
    LoRa.setTxPower(20, true); // +20dBm maximum output power

    Serial.println(F("[+] LoRa SX1276 Initialized on 868.1 MHz. Press BOOT button to transmit SOS."));
}

void sendSOSPacket() {
    IECEPacket pkt;
    pkt.version_flags = (1 << 4) | 0x00; // v1, 0x00 = Real LoRa
    pkt.victim_id = hton32(VICTIM_DEVICE_ID);

    // Read real GNSS or fallback
    double lat = gps.location.isValid() ? gps.location.lat() : 13.0827;
    double lon = gps.location.isValid() ? gps.location.lng() : 80.2707;
    uint16_t age = gps.location.isValid() ? (uint16_t)(gps.location.age() / 1000) : 10;

    int32_t lat_micro = (int32_t)round(lat * 1000000.0);
    int32_t lon_micro = (int32_t)round(lon * 1000000.0);

    pkt.lat_micro = (int32_t)hton32((uint32_t)lat_micro);
    pkt.lon_micro = (int32_t)hton32((uint32_t)lon_micro);

    // Emergency Type: 2 (Trapped in Flood), Severity: 2 (P2 Urgent)
    pkt.emergency_severity = (2 << 4) | 2;
    pkt.gps_age_sec = hton16(age);
    pkt.people_count = 3;
    pkt.timestamp = hton32(1732200000 + (millis() / 1000));

    // Transmit exact 21 bytes
    LoRa.beginPacket();
    LoRa.write((const uint8_t*)&pkt, sizeof(pkt));
    LoRa.endPacket();

    Serial.print(F("[TX] 21-Byte Packet Sent! Hex: "));
    uint8_t* p = (uint8_t*)&pkt;
    for (int i = 0; i < 21; i++) {
        if (p[i] < 0x10) Serial.print('0');
        Serial.print(p[i], HEX);
    }
    Serial.println();
}

void loop() {
    // Process incoming GPS NMEA sentences
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }

    // Trigger SOS if button pressed
    if (digitalRead(SOS_BUTTON_PIN) == LOW) {
        Serial.println(F("[!] Emergency Button Triggered!"));
        sendSOSPacket();
        delay(1500); // debounce & delay
    }

    delay(20);
}
