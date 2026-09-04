#pragma once

// Copy to config.h and keep credentials out of Git.
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define KINGMAST_API_URL "http://192.168.1.10:4000/v3/edge/frame"
#define KINGMAST_DEVICE_ID "kingmast-esp32-01"

// Reference ESP32 UART pins. Change these to match your board.
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define RADAR_RX_PIN 26
#define RADAR_TX_PIN 27

#define GPS_BAUD 9600
#define RADAR_BAUD 115200
#define PUBLISH_INTERVAL_MS 100
