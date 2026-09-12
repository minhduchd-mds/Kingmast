#pragma once

// Copy to config.h and keep credentials out of Git.
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// HTTPS is mandatory for edge telemetry outside loopback/bench development.
#define KINGMAST_API_URL "https://kingmast-gateway.example.com/v3/edge/frame"
// History-only endpoint on the Raspberry Pi. Old packets must never be replayed into /v3/edge/frame.
#define KINGMAST_HISTORY_URL "https://kingmast-pi.local:4100/v1/history/batch"
#define KINGMAST_DEVICE_ID "kingmast-esp32-01"

// Migration credential. It may remain during rollout but strict device-auth mode does not accept it
// as a substitute for a valid per-device signature on /v3/edge/frame.
#define KINGMAST_EDGE_TOKEN "REPLACE_WITH_RANDOM_TOKEN_AT_LEAST_16_CHARS"

// Transitional per-device HMAC identity for the bundled ESP32 research publisher.
// Provision these values outside source control and register the same device/key on the server/Pi history gateway.
// Production intent should migrate the private credential into hardware-protected non-exportable storage.
#define KINGMAST_DEVICE_KEY_ID "REPLACE_WITH_DEVICE_KEY_ID"
#define KINGMAST_DEVICE_HMAC_SECRET "REPLACE_WITH_RANDOM_DEVICE_SECRET_AT_LEAST_32_CHARS"

// Replace with the PEM CA certificate that validates both KINGMAST gateway endpoints.
// Production firmware must keep TLS certificate validation enabled.
static const char KINGMAST_TLS_CA_CERT[] = R"KINGMAST_CERT(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_GATEWAY_CA_CERTIFICATE
-----END CERTIFICATE-----
)KINGMAST_CERT";

#define NTP_SERVER_1 "pool.ntp.org"
#define NTP_SERVER_2 "time.google.com"

// Reference ESP32 UART pins. Change these to match your board.
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define RADAR_RX_PIN 26
#define RADAR_TX_PIN 27

// Reference VSPI microSD pins. Keep these separate from GPS/radar UART wiring.
#define SD_CS_PIN 5
#define SD_SCK_PIN 18
#define SD_MISO_PIN 19
#define SD_MOSI_PIN 23
#define SD_SPI_FREQUENCY_HZ 10000000

// ESP32 SD is a bounded store-and-forward cache, not the primary 128/256 GB archive.
// Quota is calculated from the detected card capacity and then capped for predictable MCU behavior.
#define SD_SPOOL_PERCENT 2
#define SD_RESERVE_PERCENT 10
#define SD_SPOOL_MIN_BYTES (4ULL * 1024ULL * 1024ULL)
#define SD_SPOOL_MAX_BYTES (256ULL * 1024ULL * 1024ULL)
#define SD_SPOOL_SEGMENT_BYTES (32UL * 1024UL)
#define SD_SPOOL_SEGMENT_MAX_RECORDS 48
#define HISTORY_DRAIN_INTERVAL_MS 1000

#define GPS_BAUD 9600
#define RADAR_BAUD 115200
#define PUBLISH_INTERVAL_MS 100
#define RADAR_STALE_MS 350
// Signed realtime packets are submitted at most once. Ambiguous transport failures spool to SD.
#define HTTP_RETRY_COUNT 1
