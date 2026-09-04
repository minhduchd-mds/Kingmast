#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
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

bool parseRadarCsv(const String& line,RadarTrack& track){int p1=line.indexOf(',');int p2=line.indexOf(',',p1+1);int p3=line.indexOf(',',p2+1);int p4=line.indexOf(',',p3+1);if(p1<1||p2<0||p3<0||p4<0)return false;track.id=line.substring(0,p1);track.distanceM=line.substring(p1+1,p2).toFloat();track.bearingDeg=line.substring(p2+1,p3).toFloat();track.relativeSpeedMps=line.substring(p3+1,p4).toFloat();track.confidence=line.substring(p4+1).toFloat();track.valid=track.distanceM>=0.0f&&track.distanceM<=500.0f&&track.confidence>=0.0f&&track.confidence<=1.0f;return track.valid;}
void readSensors(){while(GpsSerial.available())gps.encode(GpsSerial.read());while(RadarSerial.available()){char c=static_cast<char>(RadarSerial.read());if(c=='\n'){RadarTrack parsed;if(parseRadarCsv(radarLine,parsed)){latestTrack=parsed;lastRadarSeenMs=millis();}radarLine="";}else if(c!='\r'&&radarLine.length()<180)radarLine+=c;}}

bool postBody(const String& body){for(int attempt=0;attempt<HTTP_RETRY_COUNT;attempt++){HTTPClient http;http.begin(KINGMAST_API_URL);http.addHeader("Content-Type","application/json");if(String(KINGMAST_EDGE_TOKEN).length()>0)http.addHeader("x-kingmast-edge-token",KINGMAST_EDGE_TOKEN);http.setTimeout(1200);int status=http.POST(body);http.end();if(status>=200&&status<300)return true;delay(100*(attempt+1));}return false;}

void publishFrame(){
  if(WiFi.status()!=WL_CONNECTED){connectWifi();if(WiFi.status()!=WL_CONNECTED)return;}
  uint64_t nowEpoch=epochMillis();if(nowEpoch==0){if(!syncClock())return;nowEpoch=epochMillis();if(nowEpoch==0)return;}
  if(!gps.location.isValid())return;
  unsigned long gnssAge=gps.location.age();if(gnssAge>60000UL)gnssAge=60000UL;
  unsigned long radarAge=millis()-lastRadarSeenMs;bool radarFresh=latestTrack.valid&&lastRadarSeenMs>0&&radarAge<=RADAR_STALE_MS;

  StaticJsonDocument<3584> doc;doc["protocolVersion"]=1;doc["deviceId"]=KINGMAST_DEVICE_ID;doc["bootId"]=bootId;doc["sequence"]=sequenceNo++;doc["timestampMs"]=nowEpoch;
  JsonObject gnss=doc.createNestedObject("gnss");gnss["lat"]=gps.location.lat();gnss["lng"]=gps.location.lng();gnss["speedKmh"]=gps.speed.isValid()?gps.speed.kmph():0.0;gnss["headingDeg"]=gps.course.isValid()?gps.course.deg():0.0;gnss["accuracyM"]=gps.hdop.isValid()?gps.hdop.hdop()*5.0:25.0;gnss["timestampMs"]=nowEpoch-static_cast<uint64_t>(gnssAge);gnss["source"]="gnss";
  JsonObject sensors=doc.createNestedObject("sensors");sensors["radarFront"]=radarFresh?"ok":"unavailable";sensors["radarRear"]="unavailable";sensors["camera"]="unavailable";sensors["can"]="unavailable";sensors["gnssImu"]=gnssAge<1500UL?"ok":"degraded";sensors["ecu"]="ok";
  if(radarFresh){JsonObject radar=doc.createNestedObject("radar");radar["radarId"]="front-uart";radar["timestampMs"]=nowEpoch-static_cast<uint64_t>(radarAge);JsonArray tracks=radar.createNestedArray("tracks");JsonObject track=tracks.createNestedObject();track["id"]=latestTrack.id;track["distanceM"]=latestTrack.distanceM;track["bearingDeg"]=latestTrack.bearingDeg;track["relativeSpeedMps"]=latestTrack.relativeSpeedMps;track["confidence"]=latestTrack.confidence;track["timestampMs"]=nowEpoch-static_cast<uint64_t>(radarAge);}
  String body;serializeJson(doc,body);postBody(body);
}

void setup(){Serial.begin(115200);initBootId();GpsSerial.begin(GPS_BAUD,SERIAL_8N1,GPS_RX_PIN,GPS_TX_PIN);RadarSerial.begin(RADAR_BAUD,SERIAL_8N1,RADAR_RX_PIN,RADAR_TX_PIN);connectWifi();syncClock();}
void loop(){readSensors();unsigned long now=millis();if(now-lastPublishMs>=PUBLISH_INTERVAL_MS){lastPublishMs=now;publishFrame();}delay(2);}
