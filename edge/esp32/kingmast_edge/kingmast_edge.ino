#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <mbedtls/md.h>
#include <time.h>
#include <sys/time.h>
#include <esp_system.h>
#include "config.h"

HardwareSerial GpsSerial(1);
HardwareSerial RadarSerial(2);
TinyGPSPlus gps;

struct RadarTrack { String id; float distanceM; float bearingDeg; float relativeSpeedMps; float confidence; bool valid; };
RadarTrack latestTrack={"",0,0,0,0,false};
uint32_t sequenceNo=0;
unsigned long lastPublishMs=0;
unsigned long lastRadarSeenMs=0;
String radarLine;
String bootId;

void connectWifi(){WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);unsigned long started=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-started<15000)delay(250);}
bool syncClock(){if(WiFi.status()!=WL_CONNECTED)return false;configTime(0,0,NTP_SERVER_1,NTP_SERVER_2);unsigned long started=millis();while(millis()-started<8000){time_t now=time(nullptr);if(now>1700000000)return true;delay(200);}return false;}
uint64_t epochMillis(){struct timeval tv;gettimeofday(&tv,nullptr);if(tv.tv_sec<1700000000)return 0;return static_cast<uint64_t>(tv.tv_sec)*1000ULL+static_cast<uint64_t>(tv.tv_usec/1000);}
void initBootId(){uint64_t chip=ESP.getEfuseMac();char value[64];snprintf(value,sizeof(value),"%08lX%08lX-%08lX",static_cast<unsigned long>(chip>>32),static_cast<unsigned long>(chip&0xffffffffULL),static_cast<unsigned long>(esp_random()));bootId=String(value);}
String u64String(uint64_t value){char buffer[24];snprintf(buffer,sizeof(buffer),"%llu",static_cast<unsigned long long>(value));return String(buffer);}

bool edgeTokenConfigured(){const String token=String(KINGMAST_EDGE_TOKEN);return token.length()>=16&&token.indexOf("REPLACE_")<0;}
bool deviceHmacConfigured(){const String keyId=String(KINGMAST_DEVICE_KEY_ID);const String secret=String(KINGMAST_DEVICE_HMAC_SECRET);return String(KINGMAST_DEVICE_ID).length()>0&&keyId.length()>0&&keyId.indexOf("REPLACE_")<0&&secret.length()>=32&&secret.indexOf("REPLACE_")<0;}
bool partialDeviceHmacConfiguration(){const String keyId=String(KINGMAST_DEVICE_KEY_ID);const String secret=String(KINGMAST_DEVICE_HMAC_SECRET);const bool keyAttempted=keyId.length()>0&&keyId.indexOf("REPLACE_")<0;const bool secretAttempted=secret.length()>0&&secret.indexOf("REPLACE_")<0;return(keyAttempted||secretAttempted)&&!deviceHmacConfigured();}

bool secureConfigurationValid(){
  const String url=String(KINGMAST_API_URL);
  const String ca=String(KINGMAST_TLS_CA_CERT);
  if(!url.startsWith("https://")){Serial.println("KINGMAST: refusing non-HTTPS edge endpoint");return false;}
  if(ca.indexOf("BEGIN CERTIFICATE")<0||ca.indexOf("REPLACE_WITH_GATEWAY_CA_CERTIFICATE")>=0){Serial.println("KINGMAST: refusing placeholder TLS CA certificate");return false;}
  if(partialDeviceHmacConfiguration()){Serial.println("KINGMAST: refusing partial per-device HMAC configuration");return false;}
  if(!edgeTokenConfigured()&&!deviceHmacConfigured()){Serial.println("KINGMAST: provision an edge token or per-device HMAC identity");return false;}
  return true;
}

String hmacSha256Hex(const String& message,const String& secret){
  unsigned char digest[32];
  const mbedtls_md_info_t* info=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if(info==nullptr)return String();
  int rc=mbedtls_md_hmac(info,reinterpret_cast<const unsigned char*>(secret.c_str()),secret.length(),reinterpret_cast<const unsigned char*>(message.c_str()),message.length(),digest);
  if(rc!=0)return String();
  char output[65];
  for(size_t i=0;i<32;i++)snprintf(output+(i*2),3,"%02x",digest[i]);
  output[64]='\0';
  return String(output);
}

String canonicalPacketMessage(const String& body,uint32_t packetSequence,uint64_t timestampMs){
  String message="KINGMAST-EDGE-V1\n";
  message+=String(KINGMAST_DEVICE_ID);message+='\n';
  message+=String(KINGMAST_DEVICE_KEY_ID);message+='\n';
  message+=bootId;message+='\n';
  message+=String(packetSequence);message+='\n';
  message+=u64String(timestampMs);message+='\n';
  message+=body;
  return message;
}

bool parseRadarCsv(const String& line,RadarTrack& track){int p1=line.indexOf(',');int p2=line.indexOf(',',p1+1);int p3=line.indexOf(',',p2+1);int p4=line.indexOf(',',p3+1);if(p1<1||p2<0||p3<0||p4<0)return false;track.id=line.substring(0,p1);track.distanceM=line.substring(p1+1,p2).toFloat();track.bearingDeg=line.substring(p2+1,p3).toFloat();track.relativeSpeedMps=line.substring(p3+1,p4).toFloat();track.confidence=line.substring(p4+1).toFloat();track.valid=track.distanceM>=0.0f&&track.distanceM<=500.0f&&track.confidence>=0.0f&&track.confidence<=1.0f;return track.valid;}
void readSensors(){while(GpsSerial.available())gps.encode(GpsSerial.read());while(RadarSerial.available()){char c=static_cast<char>(RadarSerial.read());if(c=='\n'){RadarTrack parsed;if(parseRadarCsv(radarLine,parsed)){latestTrack=parsed;lastRadarSeenMs=millis();}radarLine="";}else if(c!='\r'&&radarLine.length()<180)radarLine+=c;}}

bool postBody(const String& body,uint32_t packetSequence,uint64_t timestampMs){
  if(!secureConfigurationValid())return false;
  for(int attempt=0;attempt<HTTP_RETRY_COUNT;attempt++){
    WiFiClientSecure tlsClient;
    tlsClient.setCACert(KINGMAST_TLS_CA_CERT);
    HTTPClient http;
    if(!http.begin(tlsClient,KINGMAST_API_URL)){delay(100*(attempt+1));continue;}
    http.addHeader("Content-Type","application/json");
    if(edgeTokenConfigured())http.addHeader("x-kingmast-edge-token",KINGMAST_EDGE_TOKEN);
    if(deviceHmacConfigured()){
      const String signature=hmacSha256Hex(canonicalPacketMessage(body,packetSequence,timestampMs),String(KINGMAST_DEVICE_HMAC_SECRET));
      if(signature.length()!=64){http.end();Serial.println("KINGMAST: failed to create device packet signature");return false;}
      http.addHeader("x-kingmast-device-key-id",KINGMAST_DEVICE_KEY_ID);
      http.addHeader("x-kingmast-device-signature",signature);
    }
    http.setTimeout(1200);
    int status=http.POST(body);
    http.end();
    if(status>=200&&status<300)return true;
    delay(100*(attempt+1));
  }
  return false;
}

void publishFrame(){
  if(WiFi.status()!=WL_CONNECTED){connectWifi();if(WiFi.status()!=WL_CONNECTED)return;}
  uint64_t nowEpoch=epochMillis();if(nowEpoch==0){if(!syncClock())return;nowEpoch=epochMillis();if(nowEpoch==0)return;}
  if(!gps.location.isValid())return;
  unsigned long gnssAge=gps.location.age();if(gnssAge>60000UL)gnssAge=60000UL;
  unsigned long radarAge=millis()-lastRadarSeenMs;bool radarFresh=latestTrack.valid&&lastRadarSeenMs>0&&radarAge<=RADAR_STALE_MS;
  uint32_t packetSequence=sequenceNo++;

  // Insert every object key in lexical order so serialized JSON matches the server's stable canonical form.
  StaticJsonDocument<3584> doc;
  doc["bootId"]=bootId;
  doc["deviceId"]=KINGMAST_DEVICE_ID;
  JsonObject gnss=doc.createNestedObject("gnss");
  gnss["accuracyM"]=gps.hdop.isValid()?gps.hdop.hdop()*5.0:25.0;
  gnss["headingDeg"]=gps.course.isValid()?gps.course.deg():0.0;
  gnss["lat"]=gps.location.lat();
  gnss["lng"]=gps.location.lng();
  gnss["source"]="gnss";
  gnss["speedKmh"]=gps.speed.isValid()?gps.speed.kmph():0.0;
  gnss["timestampMs"]=nowEpoch-static_cast<uint64_t>(gnssAge);
  doc["protocolVersion"]=1;
  if(radarFresh){
    JsonObject radar=doc.createNestedObject("radar");
    radar["radarId"]="front-uart";
    radar["timestampMs"]=nowEpoch-static_cast<uint64_t>(radarAge);
    JsonArray tracks=radar.createNestedArray("tracks");
    JsonObject track=tracks.createNestedObject();
    track["bearingDeg"]=latestTrack.bearingDeg;
    track["confidence"]=latestTrack.confidence;
    track["distanceM"]=latestTrack.distanceM;
    track["id"]=latestTrack.id;
    track["relativeSpeedMps"]=latestTrack.relativeSpeedMps;
    track["timestampMs"]=nowEpoch-static_cast<uint64_t>(radarAge);
  }
  JsonObject sensors=doc.createNestedObject("sensors");
  sensors["camera"]="unavailable";
  sensors["can"]="unavailable";
  sensors["ecu"]="ok";
  sensors["gnssImu"]=gnssAge<1500UL?"ok":"degraded";
  sensors["radarFront"]=radarFresh?"ok":"unavailable";
  sensors["radarRear"]="unavailable";
  doc["sequence"]=packetSequence;
  doc["timestampMs"]=nowEpoch;

  String body;serializeJson(doc,body);postBody(body,packetSequence,nowEpoch);
}

void setup(){Serial.begin(115200);if(!secureConfigurationValid())Serial.println("KINGMAST: secure edge publishing disabled until config.h is provisioned");initBootId();GpsSerial.begin(GPS_BAUD,SERIAL_8N1,GPS_RX_PIN,GPS_TX_PIN);RadarSerial.begin(RADAR_BAUD,SERIAL_8N1,RADAR_RX_PIN,RADAR_TX_PIN);connectWifi();syncClock();}
void loop(){readSensors();unsigned long now=millis();if(now-lastPublishMs>=PUBLISH_INTERVAL_MS){lastPublishMs=now;publishFrame();}delay(2);}
