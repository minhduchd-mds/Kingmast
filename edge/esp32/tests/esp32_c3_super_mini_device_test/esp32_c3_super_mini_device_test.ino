#include <WiFi.h>
#include <WebServer.h>

// KINGMAST ESP32-C3 Super Mini device bring-up test.
// Bench/test firmware only. Do not use this sketch as the production vehicle firmware.

static const char* AP_SSID = "KINGMAST-C3-TEST";
static const char* AP_PASSWORD = "12345678";

// Most ESP32-C3 Super Mini boards use GPIO 8 for the onboard LED.
// Change these two values if your board revision behaves differently.
#define TEST_LED_PIN 8
#define TEST_LED_ON LOW
#define TEST_LED_OFF HIGH

WebServer server(80);
bool ledState = false;
unsigned long bootMs = 0;
bool apStarted = false;

static const char PAGE[] PROGMEM = R"HTML(
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KINGMAST C3 Device Test</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#06090f;color:#fff}.wrap{width:min(920px,94%);margin:auto;padding:28px 0}.brand{letter-spacing:4px;font-size:12px;color:#8692a3}h1{margin:8px 0 4px;font-size:30px}.sub{color:#7c8797}.ok{display:inline-block;margin-top:14px;padding:7px 11px;border-radius:20px;background:rgba(44,210,110,.12);color:#67e89b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:18px}.card{padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.04)}.label{font-size:11px;color:#788596;margin-bottom:7px}.value{font-size:21px;font-weight:650}.section{margin-top:12px}.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}button{border:0;border-radius:11px;padding:11px 16px;background:#1687ff;color:#fff;margin-right:8px;cursor:pointer}button.alt{background:rgba(255,255,255,.08)}pre{white-space:pre-wrap;color:#b8c2d0;font-size:12px;margin:0}.muted{color:#788596;font-size:12px}.pass{color:#67e89b}.warn{color:#ffc85a}</style>
</head>
<body><div class="wrap">
<div class="brand">KINGMAST</div><h1>ESP32-C3 Device Test</h1><div class="sub">Bench diagnostic · Super Mini</div><div class="ok" id="online">SYSTEM ONLINE</div>
<div class="grid">
<div class="card"><div class="label">CHIP</div><div class="value" id="chip">--</div></div>
<div class="card"><div class="label">CPU</div><div class="value"><span id="cpu">--</span> MHz</div></div>
<div class="card"><div class="label">FLASH</div><div class="value"><span id="flash">--</span> MB</div></div>
<div class="card"><div class="label">FREE HEAP</div><div class="value"><span id="heap">--</span> KB</div></div>
<div class="card"><div class="label">UPTIME</div><div class="value"><span id="uptime">--</span> s</div></div>
<div class="card"><div class="label">CONNECTED</div><div class="value" id="clients">--</div></div>
</div>
<div class="card section"><div class="label">SELF TEST</div><div class="row"><span>Wi-Fi AP</span><span id="wifi" class="pass">--</span></div><div class="row"><span>Flash >= 4 MB</span><span id="flashTest">--</span></div><div class="row"><span>Heap > 100 KB</span><span id="heapTest">--</span></div><div class="row"><span>LED GPIO</span><span id="led">OFF</span></div><div style="margin-top:14px"><button onclick="led(1)">Bật LED</button><button class="alt" onclick="led(0)">Tắt LED</button></div></div>
<div class="card section"><div class="label">WI-FI SCAN</div><button onclick="scan()">Quét Wi-Fi</button><div class="muted" style="margin:10px 0">ESP32 chạy AP+STA nên vẫn giữ mạng KINGMAST-C3-TEST trong lúc quét.</div><pre id="scan">Chưa quét.</pre></div>
<div class="card section"><div class="label">ACCESS</div><div class="row"><span>SSID</span><span>KINGMAST-C3-TEST</span></div><div class="row"><span>IP</span><span id="ip">--</span></div><div class="row"><span>MAC</span><span id="mac">--</span></div></div>
</div>
<script>
async function status(){try{const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();chip.textContent=d.chip;cpu.textContent=d.cpu;flash.textContent=d.flashMB;heap.textContent=d.freeHeapKB;uptime.textContent=d.uptime;clients.textContent=d.clients;ip.textContent=d.ip;mac.textContent=d.mac;wifi.textContent=d.ap?'PASS':'FAIL';flashTest.textContent=d.flashMB>=4?'PASS':'CHECK';flashTest.className=d.flashMB>=4?'pass':'warn';heapTest.textContent=d.freeHeapKB>100?'PASS':'CHECK';heapTest.className=d.freeHeapKB>100?'pass':'warn';led.textContent=d.led?'ON':'OFF';online.textContent='SYSTEM ONLINE'}catch(e){online.textContent='CONNECTION LOST'}}
async function led(v){await fetch('/api/led?state='+v);status()}
async function scan(){document.getElementById('scan').textContent='Đang quét...';try{const r=await fetch('/api/scan');const d=await r.json();document.getElementById('scan').textContent=d.networks.map((n,i)=>`${i+1}. ${n.ssid || '[hidden]'} | ${n.rssi} dBm | ch ${n.channel} | ${n.open?'OPEN':'SECURED'}`).join('\n') || 'Không tìm thấy mạng.'}catch(e){document.getElementById('scan').textContent='Scan failed'}}
status();setInterval(status,1000);
</script></body></html>
)HTML";

String jsonEscape(const String& in) {
  String out;
  out.reserve(in.length() + 8);
  for (size_t i = 0; i < in.length(); ++i) {
    const char c = in[i];
    if (c == '\\' || c == '"') { out += '\\'; out += c; }
    else if (c == '\n') out += "\\n";
    else if (c == '\r') out += "\\r";
    else if (static_cast<uint8_t>(c) >= 0x20) out += c;
  }
  return out;
}

void handleRoot() {
  server.send_P(200, "text/html; charset=utf-8", PAGE);
}

void handleStatus() {
  String json;
  json.reserve(320);
  json = "{";
  json += "\"chip\":\"" + jsonEscape(String(ESP.getChipModel())) + "\",";
  json += "\"revision\":" + String(ESP.getChipRevision()) + ",";
  json += "\"cpu\":" + String(ESP.getCpuFreqMHz()) + ",";
  json += "\"flashMB\":" + String(ESP.getFlashChipSize() / 1024 / 1024) + ",";
  json += "\"freeHeapKB\":" + String(ESP.getFreeHeap() / 1024) + ",";
  json += "\"uptime\":" + String((millis() - bootMs) / 1000) + ",";
  json += "\"clients\":" + String(WiFi.softAPgetStationNum()) + ",";
  json += "\"ip\":\"" + WiFi.softAPIP().toString() + "\",";
  json += "\"mac\":\"" + WiFi.softAPmacAddress() + "\",";
  json += "\"ap\":" + String(apStarted ? "true" : "false") + ",";
  json += "\"led\":" + String(ledState ? "true" : "false");
  json += "}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void handleLed() {
  if (server.hasArg("state")) {
    ledState = server.arg("state") == "1";
    digitalWrite(TEST_LED_PIN, ledState ? TEST_LED_ON : TEST_LED_OFF);
  }
  server.send(200, "text/plain", "OK");
}

void handleScan() {
  const int count = WiFi.scanNetworks(false, true);
  String json = "{\"networks\":[";
  for (int i = 0; i < count; ++i) {
    if (i) json += ',';
    json += "{\"ssid\":\"" + jsonEscape(WiFi.SSID(i)) + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI(i)) + ",";
    json += "\"channel\":" + String(WiFi.channel(i)) + ",";
    json += "\"open\":" + String(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  json += "]}";
  WiFi.scanDelete();
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void printBootReport() {
  Serial.println();
  Serial.println("========================================");
  Serial.println(" KINGMAST ESP32-C3 DEVICE TEST");
  Serial.println("========================================");
  Serial.printf("Chip       : %s rev %d\n", ESP.getChipModel(), ESP.getChipRevision());
  Serial.printf("CPU        : %d MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash      : %u MB\n", ESP.getFlashChipSize() / 1024 / 1024);
  Serial.printf("Free heap  : %u KB\n", ESP.getFreeHeap() / 1024);
  Serial.printf("WiFi AP    : %s\n", apStarted ? "PASS" : "FAIL");
  Serial.printf("SSID       : %s\n", AP_SSID);
  Serial.printf("Password   : %s\n", AP_PASSWORD);
  Serial.printf("IP         : %s\n", WiFi.softAPIP().toString().c_str());
  Serial.printf("MAC        : %s\n", WiFi.softAPmacAddress().c_str());
  Serial.println("Dashboard  : http://192.168.4.1");
  Serial.println("========================================");
}

void setup() {
  Serial.begin(115200);
  delay(1200);
  bootMs = millis();

  pinMode(TEST_LED_PIN, OUTPUT);
  digitalWrite(TEST_LED_PIN, TEST_LED_OFF);

  // Quick visible LED bring-up indication.
  for (int i = 0; i < 2; ++i) {
    digitalWrite(TEST_LED_PIN, TEST_LED_ON);
    delay(120);
    digitalWrite(TEST_LED_PIN, TEST_LED_OFF);
    delay(120);
  }

  // AP+STA keeps the diagnostic AP active while allowing nearby Wi-Fi scans.
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  WiFi.disconnect();
  apStarted = WiFi.softAP(AP_SSID, AP_PASSWORD, 1, false, 4);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/led", HTTP_GET, handleLed);
  server.on("/api/scan", HTTP_GET, handleScan);
  server.onNotFound([]() { server.send(404, "text/plain", "KINGMAST C3 TEST: Not found"); });
  server.begin();

  printBootReport();
}

void loop() {
  server.handleClient();
  delay(2);
}
