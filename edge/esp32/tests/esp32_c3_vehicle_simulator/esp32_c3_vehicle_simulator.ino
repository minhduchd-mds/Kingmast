#include <WiFi.h>
#include <WebServer.h>

// KINGMAST ESP32-C3 Super Mini vehicle telemetry simulator.
// Bench/test firmware only. Not for vehicle control or production safety use.

static const char* AP_SSID = "KINGMAST-C3-TEST";
static const char* AP_PASSWORD = "12345678";

#define LED_PIN 8
#define LED_ON LOW
#define LED_OFF HIGH

WebServer server(80);

enum SimMode { MODE_SAFE, MODE_WATCH, MODE_WARNING, MODE_DANGER, MODE_SENSOR_LOST, MODE_UPLINK_LOST };

struct VehicleTelemetry {
  float speedKph;
  float distanceM;
  float relativeSpeedMps;
  float bearingDeg;
  float confidence;
  bool sensorOnline;
  bool uplinkOnline;
};

SimMode currentMode = MODE_SAFE;
VehicleTelemetry telemetry;
unsigned long bootMs = 0;
unsigned long lastLedMs = 0;
bool ledState = false;

void addCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Cache-Control", "no-store");
}

String modeName() {
  switch (currentMode) {
    case MODE_SAFE: return "SAFE";
    case MODE_WATCH: return "WATCH";
    case MODE_WARNING: return "WARNING";
    case MODE_DANGER: return "DANGER";
    case MODE_SENSOR_LOST: return "SENSOR_LOST";
    case MODE_UPLINK_LOST: return "UPLINK_LOST";
  }
  return "UNKNOWN";
}

void applyMode() {
  switch (currentMode) {
    case MODE_SAFE: telemetry = {45.0f, 55.0f, -1.0f, 2.0f, 0.98f, true, true}; break;
    case MODE_WATCH: telemetry = {50.0f, 24.0f, -3.0f, 5.0f, 0.95f, true, true}; break;
    case MODE_WARNING: telemetry = {55.0f, 11.0f, -4.5f, 7.0f, 0.96f, true, true}; break;
    case MODE_DANGER: telemetry = {62.0f, 4.2f, -7.5f, 3.0f, 0.99f, true, true}; break;
    case MODE_SENSOR_LOST: telemetry = {40.0f, -1.0f, 0.0f, 0.0f, 0.0f, false, true}; break;
    case MODE_UPLINK_LOST: telemetry = {48.0f, 20.0f, -2.0f, 1.0f, 0.92f, true, false}; break;
  }
}

float calculateTtc() {
  if (!telemetry.sensorOnline || telemetry.distanceM < 0 || telemetry.relativeSpeedMps >= -0.1f) return -1.0f;
  return telemetry.distanceM / (-telemetry.relativeSpeedMps);
}

String riskLevel() {
  if (!telemetry.sensorOnline) return "SENSOR_LOST";
  const float ttc = calculateTtc();
  if (telemetry.distanceM <= 5.0f || (ttc > 0 && ttc <= 1.5f)) return "DANGER";
  if (telemetry.distanceM <= 15.0f || (ttc > 0 && ttc <= 3.0f)) return "WARNING";
  if (telemetry.distanceM <= 30.0f || (ttc > 0 && ttc <= 6.0f)) return "WATCH";
  return "SAFE";
}

void updateLed() {
  const String risk = riskLevel();
  unsigned long interval = 0;
  if (risk == "SAFE") {
    ledState = false;
    digitalWrite(LED_PIN, LED_OFF);
    return;
  }
  if (risk == "WATCH") interval = 900;
  else if (risk == "WARNING") interval = 300;
  else if (risk == "DANGER") interval = 100;
  else interval = 600;
  if (millis() - lastLedMs >= interval) {
    lastLedMs = millis();
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? LED_ON : LED_OFF);
  }
}

String telemetryJson() {
  const float ttc = calculateTtc();
  String json;
  json.reserve(520);
  json = "{";
  json += "\"deviceId\":\"KINGMAST-C3-TEST-01\",";
  json += "\"chip\":\"" + String(ESP.getChipModel()) + "\",";
  json += "\"mode\":\"" + modeName() + "\",";
  json += "\"speedKph\":" + String(telemetry.speedKph, 2) + ",";
  json += "\"distanceM\":" + String(telemetry.distanceM, 2) + ",";
  json += "\"relativeSpeedMps\":" + String(telemetry.relativeSpeedMps, 2) + ",";
  json += "\"bearingDeg\":" + String(telemetry.bearingDeg, 2) + ",";
  json += "\"confidence\":" + String(telemetry.confidence, 2) + ",";
  json += "\"ttc\":" + String(ttc, 2) + ",";
  json += "\"risk\":\"" + riskLevel() + "\",";
  json += "\"sensorOnline\":" + String(telemetry.sensorOnline ? "true" : "false") + ",";
  json += "\"uplinkOnline\":" + String(telemetry.uplinkOnline ? "true" : "false") + ",";
  json += "\"clients\":" + String(WiFi.softAPgetStationNum()) + ",";
  json += "\"uptime\":" + String((millis() - bootMs) / 1000);
  json += "}";
  return json;
}

static const char PAGE[] PROGMEM = R"HTML(
<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KINGMAST C3 V2</title>
<style>*{box-sizing:border-box}body{margin:0;background:#070b11;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.w{width:min(920px,94%);margin:auto;padding:28px 0}.brand{letter-spacing:4px;color:#8290a2;font-size:12px}h1{margin:8px 0 4px}.sub{color:#758194}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px}.c{padding:18px;border:1px solid #ffffff14;border-radius:18px;background:#ffffff0a}.l{font-size:11px;color:#788596}.v{font-size:24px;font-weight:650;margin-top:6px}.risk{font-size:34px}.buttons{margin-top:12px}button{border:0;border-radius:11px;padding:11px 14px;margin:4px;background:#177ff0;color:#fff;cursor:pointer}.danger{background:#d8444b}pre{white-space:pre-wrap;color:#aeb9c8}</style></head>
<body><div class="w"><div class="brand">KINGMAST LAB</div><h1>ESP32-C3 Vehicle Simulator</h1><div class="sub">Telemetry + Risk Engine bench test</div><div class="grid"><div class="c"><div class="l">SPEED</div><div class="v" id="speed">--</div></div><div class="c"><div class="l">DISTANCE</div><div class="v" id="distance">--</div></div><div class="c"><div class="l">TTC</div><div class="v" id="ttc">--</div></div><div class="c"><div class="l">RISK</div><div class="v risk" id="risk">--</div></div></div><div class="c buttons"><button onclick="m('safe')">An toàn</button><button onclick="m('watch')">Theo dõi</button><button onclick="m('warning')">Cảnh báo</button><button class="danger" onclick="m('danger')">Nguy hiểm</button><button onclick="m('sensor_lost')">Mất cảm biến</button><button onclick="m('uplink_lost')">Mất uplink</button></div><div class="c"><div class="l">RAW TELEMETRY</div><pre id="raw">--</pre></div></div>
<script>async function u(){try{const r=await fetch('/api/telemetry',{cache:'no-store'});const d=await r.json();speed.textContent=d.speedKph.toFixed(1)+' km/h';distance.textContent=d.sensorOnline?d.distanceM.toFixed(1)+' m':'--';ttc.textContent=d.ttc>0?d.ttc.toFixed(2)+' s':'--';risk.textContent=d.risk;raw.textContent=JSON.stringify(d,null,2)}catch(e){raw.textContent='Connection lost'}}async function m(v){await fetch('/api/mode?state='+v);u()}u();setInterval(u,500)</script></body></html>
)HTML";

void handleTelemetry() {
  addCors();
  server.send(200, "application/json", telemetryJson());
}

void handleMode() {
  if (!server.hasArg("state")) { addCors(); server.send(400, "text/plain", "Missing state"); return; }
  const String state = server.arg("state");
  if (state == "safe") currentMode = MODE_SAFE;
  else if (state == "watch") currentMode = MODE_WATCH;
  else if (state == "warning") currentMode = MODE_WARNING;
  else if (state == "danger") currentMode = MODE_DANGER;
  else if (state == "sensor_lost") currentMode = MODE_SENSOR_LOST;
  else if (state == "uplink_lost") currentMode = MODE_UPLINK_LOST;
  else { addCors(); server.send(400, "text/plain", "Invalid mode"); return; }
  applyMode();
  addCors();
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  delay(1200);
  bootMs = millis();
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_OFF);
  applyMode();

  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  const bool apOk = WiFi.softAP(AP_SSID, AP_PASSWORD, 1, false, 4);

  server.on("/", HTTP_GET, [](){ server.send_P(200, "text/html; charset=utf-8", PAGE); });
  server.on("/api/telemetry", HTTP_GET, handleTelemetry);
  server.on("/api/mode", HTTP_GET, handleMode);
  server.on("/api/telemetry", HTTP_OPTIONS, [](){ addCors(); server.send(204); });
  server.on("/api/mode", HTTP_OPTIONS, [](){ addCors(); server.send(204); });
  server.onNotFound([](){ addCors(); server.send(404, "text/plain", "KINGMAST C3 V2: Not Found"); });
  server.begin();

  Serial.println();
  Serial.println("========================================");
  Serial.println(" KINGMAST ESP32-C3 TEST V2");
  Serial.println(" Vehicle Sensor Simulator");
  Serial.println("========================================");
  Serial.printf("Chip      : %s\n", ESP.getChipModel());
  Serial.printf("CPU       : %d MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash     : %u MB\n", ESP.getFlashChipSize() / 1024 / 1024);
  Serial.printf("WiFi AP   : %s\n", apOk ? "PASS" : "FAIL");
  Serial.printf("SSID      : %s\n", AP_SSID);
  Serial.printf("Password  : %s\n", AP_PASSWORD);
  Serial.println("Dashboard : http://192.168.4.1");
  Serial.println("API       : http://192.168.4.1/api/telemetry");
  Serial.println("========================================");
}

void loop() {
  server.handleClient();
  updateLed();
  delay(2);
}
