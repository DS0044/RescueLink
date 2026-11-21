/**
 * RescueLink ESP32 LoRa Gateway
 * Receives 21-byte binary SOS packets over 868.1MHz / 915MHz SX1276,
 * packages RF metrics (RSSI, SNR), and outputs JSON lines over USB Serial
 * to the serial bridge script connected to the FastAPI backend.
 */

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

#define LORA_SCK     18
#define LORA_MISO    19
#define LORA_MOSI    23
#define LORA_SS      5
#define LORA_RST     14
#define LORA_DIO0    2

#define LORA_BAND    868.1E6 // Match sender frequency
#define SPREADING_FACTOR 10
#define SIGNAL_BANDWIDTH 125E3
#define CODING_RATE  5

void setup() {
    Serial.begin(115200);
    while (!Serial);

    Serial.println(F("[RESCUE LINK GATEWAY] Booting SX1276 Receiver..."));

    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

    if (!LoRa.begin(LORA_BAND)) {
        Serial.println(F("[-] LoRa gateway init failed! Check wiring."));
        while (1) { delay(1000); }
    }

    LoRa.setSpreadingFactor(SPREADING_FACTOR);
    LoRa.setSignalBandwidth(SIGNAL_BANDWIDTH);
    LoRa.setCodingRate4(CODING_RATE);

    Serial.println(F("[+] Gateway Ready. Listening for 21-byte SOS packets..."));
}

void loop() {
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        int rssi = LoRa.packetRssi();
        float snr = LoRa.packetSnr();

        uint8_t buffer[64];
        int bytesRead = 0;
        while (LoRa.available() && bytesRead < 64) {
            buffer[bytesRead++] = LoRa.read();
        }

        // Verify exact 21-byte packet size
        if (bytesRead == 21) {
            char hexString[43];
            for (int i = 0; i < 21; i++) {
                sprintf(&hexString[i * 2], "%02X", buffer[i]);
            }
            hexString[42] = '\0';

            // Output JSON for the python serial bridge
            Serial.print(F("RESCUELINK_UPLINK:"));
            Serial.print(F("{\"raw_hex\":\""));
            Serial.print(hexString);
            Serial.print(F("\",\"rssi_dbm\":"));
            Serial.print(rssi);
            Serial.print(F(",\"snr_db\":"));
            Serial.print(snr, 1);
            Serial.println(F("}"));
        } else {
            Serial.print(F("[WARN] Ignored non-IECE packet of size: "));
            Serial.println(bytesRead);
        }
    }
}
