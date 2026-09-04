#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include "config.h"

HardwareSerial GpsSerial(1);
HardwareSerial RadarSerial(2);
TinyGPSPlus gps;

struct RadarTrack {
  String id;
  float distanceM;
  float bearingDeg;
  float relativeSpeedMps;
  float confidence;
  bool valid;
};

RadarTrack latestTrack = {"", 0, 0, 0, 0, false};
uint32_t sequenceNo = 0;
unsigned long lastPublishMs = 0;
String radarLine;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
  }
}

bool parseRadarCsv(const String& line, RadarTrack& track) {
  // Vendor-neutral development format:
  // id,distance_m,bearing_deg,relative_speed_mps,confidence
  // Replace this parser with the radar vendor's documented UART/CAN protocol adapter.
  int p1 = line.indexOf(',');
  int p2 = line.indexOf(',', p1 + 1);
  int p3 = line.indexOf(',', p2 + 1);
  int p4 = line.indexOf(',', p3 + 1);
  if (p1 < 1 || p2 < 0 || p3 < 0 || p4 < 0) return false;

  track.id = line.substring(0, p1);
  track.distanceM = line.substring(p1 + 1, p2).toFloat();
  track.bearingDeg = line.substring(p2 + 1, p3).toFloat();
  track.relativeSpeedMps = line.substring(p3 + 1, p4).toFloat();
  track.confidence = line.substring(p4 + 1).toFloat();
  track.valid = track.distanceM >= 0.0f && track.distanceM <= 500.0f && track.confidence >= 0.0f && track.confidence <= 1.0f;
  return track.valid;
}

void readSensors() {
  while (GpsSerial.available()) gps.encode(GpsSerial.read());

  while (RadarSerial.available()) {
    char c = static_cast<char>(RadarSerial.read());
    if (c == '\n') {
      RadarTrack parsed;
      if (parseRadarCsv(radarLine, parsed)) latestTrack = parsed;
      radarLine = "";
    } else if (c != '\r' && radarLine.length() < 180) {
      radarLine += c;
    }
  }
}

void publishFrame() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) return;
  }
  if (!gps.location.isValid()) return;

  StaticJsonDocument<3072> doc;
  doc["deviceId"] = KINGMAST_DEVICE_ID;
  doc["sequence"] = sequenceNo++;
  doc["timestampMs"] = millis();

  JsonObject gnss = doc.createNestedObject("gnss");
  gnss["lat"] = gps.location.lat();
  gnss["lng"] = gps.location.lng();
  gnss["speedKmh"] = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
  gnss["headingDeg"] = gps.course.isValid() ? gps.course.deg() : 0.0;
  gnss["accuracyM"] = gps.hdop.isValid() ? gps.hdop.hdop() * 5.0 : 25.0;
  gnss["timestampMs"] = millis();
  gnss["source"] = "gnss";

  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["radarFront"] = latestTrack.valid ? "ok" : "unavailable";
  sensors["radarRear"] = "unavailable";
  sensors["camera"] = "unavailable";
  sensors["can"] = "unavailable";
  sensors["gnssImu"] = gps.location.isValid() ? "ok" : "degraded";
  sensors["ecu"] = "ok";

  if (latestTrack.valid) {
    JsonObject radar = doc.createNestedObject("radar");
    radar["radarId"] = "front-uart";
    radar["timestampMs"] = millis();
    JsonArray tracks = radar.createNestedArray("tracks");
    JsonObject track = tracks.createNestedObject();
    track["id"] = latestTrack.id;
    track["distanceM"] = latestTrack.distanceM;
    track["bearingDeg"] = latestTrack.bearingDeg;
    track["relativeSpeedMps"] = latestTrack.relativeSpeedMps;
    track["confidence"] = latestTrack.confidence;
    track["timestampMs"] = millis();
  }

  String body;
  serializeJson(doc, body);
  HTTPClient http;
  http.begin(KINGMAST_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(1200);
  http.POST(body);
  http.end();
}

void setup() {
  Serial.begin(115200);
  GpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  RadarSerial.begin(RADAR_BAUD, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
  connectWifi();
}

void loop() {
  readSensors();
  unsigned long now = millis();
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishFrame();
  }
  delay(2);
}
