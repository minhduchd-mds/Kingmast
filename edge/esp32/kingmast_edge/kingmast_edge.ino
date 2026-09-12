#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <mbedtls/md.h>
#include <time.h>
#include <sys/time.h>
#include <esp_system.h>
#include <SPI.h>
#include <SD.h>
#include "config.h"

HardwareSerial GpsSerial(1);
HardwareSerial RadarSerial(2);
TinyGPSPlus gps;

struct RadarTrack { String id; float distanceM; float bearingDeg; float relativeSpeedMps; float confidence; bool valid; };
RadarTrack latestTrack={"",0,0,0,0,false};
uint32_t sequenceNo=0;
unsigned long lastPublishMs=0;
unsigned long lastRadarSeenMs=0;
unsigned long lastHistoryDrainMs=0;
String radarLine;
String bootId;
String currentSpoolPath;
uint16_t currentSpoolRecords=0;
bool sdReady=false;
uint32_t sdSpooledPackets=0;
uint32_t sdDroppedPackets=0;
uint32_t sdRecoveredSegments=0;

static const char* SPOOL_DIR="/kingmast/spool";

void connectWifi(){WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);unsigned long started=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-started<15000)delay(250);}
bool syncClock(){if(WiFi.status()!=WL_CONNECTED)return false;configTime(0,0,NTP_SERVER_1,NTP_SERVER_2);unsigned long started=millis();while(millis()-started<8000){time_t now=time(nullptr);if(now>1700000000)return true;delay(200);}return false;}
uint64_t epochMillis(){struct timeval tv;gettimeofday(&tv,nullptr);if(tv.tv_sec<1700000000)return 0;return static_cast<uint64_t>(tv.tv_sec)*1000ULL+static_cast<uint64_t>(tv.tv_usec/1000);}
void initBootId(){uint64_t chip=ESP.getEfuseMac();char value[64];snprintf(value,sizeof(value),"%08lX%08lX-%08lX",static_cast<unsigned long>(chip>>32),static_cast<unsigned long>(chip&0xffffffffULL),static_cast<unsigned long>(esp_random()));bootId=String(value);}
String u64String(uint64_t value){char buffer[24];snprintf(buffer,sizeof(buffer),"%llu",static_cast<unsigned long long>(value));return String(buffer);}

bool edgeTokenConfigured(){const String token=String(KINGMAST_EDGE_TOKEN);return token.length()>=16&&token.indexOf("REPLACE_")<0;}
bool deviceHmacConfigured(){const String keyId=String(KINGMAST_DEVICE_KEY_ID);const String secret=String(KINGMAST_DEVICE_HMAC_SECRET);return String(KINGMAST_DEVICE_ID).length()>0&&keyId.length()>0&&keyId.indexOf("REPLACE_")<0&&secret.length()>=32&&secret.indexOf("REPLACE_")<0;}
bool partialDeviceHmacConfiguration(){const String keyId=String(KINGMAST_DEVICE_KEY_ID);const String secret=String(KINGMAST_DEVICE_HMAC_SECRET);const bool keyAttempted=keyId.length()>0&&keyId.indexOf("REPLACE_")<0;const bool secretAttempted=secret.length()>0&&secret.indexOf("REPLACE_")<0;return(keyAttempted||secretAttempted)&&!deviceHmacConfigured();}
bool historyUrlConfigured(){const String url=String(KINGMAST_HISTORY_URL);return url.startsWith("https://")&&url.length()<256;}

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

String devicePacketSignature(const String& body,uint32_t packetSequence,uint64_t timestampMs){
  if(!deviceHmacConfigured())return String();
  return hmacSha256Hex(canonicalPacketMessage(body,packetSequence,timestampMs),String(KINGMAST_DEVICE_HMAC_SECRET));
}

bool initSdSpool(){
  SPI.begin(SD_SCK_PIN,SD_MISO_PIN,SD_MOSI_PIN,SD_CS_PIN);
  if(!SD.begin(SD_CS_PIN,SPI,SD_SPI_FREQUENCY_HZ)){Serial.println("KINGMAST: SD unavailable; realtime remains active without offline spool");return false;}
  if(!SD.exists("/kingmast")&&!SD.mkdir("/kingmast")){Serial.println("KINGMAST: cannot create SD /kingmast directory");return false;}
  if(!SD.exists(SPOOL_DIR)&&!SD.mkdir(SPOOL_DIR)){Serial.println("KINGMAST: cannot create SD spool directory");return false;}
  const uint64_t total=SD.totalBytes();
  Serial.printf("KINGMAST: SD spool ready total=%llu used=%llu\n",static_cast<unsigned long long>(total),static_cast<unsigned long long>(SD.usedBytes()));
  return total>0;
}

uint64_t sdSpoolQuotaBytes(){
  if(!sdReady)return 0;
  const uint64_t total=SD.totalBytes();
  uint64_t quota=(total*static_cast<uint64_t>(SD_SPOOL_PERCENT))/100ULL;
  if(quota<SD_SPOOL_MIN_BYTES)quota=SD_SPOOL_MIN_BYTES;
  if(quota>SD_SPOOL_MAX_BYTES)quota=SD_SPOOL_MAX_BYTES;
  return quota;
}

uint64_t spoolUsageBytes(){
  if(!sdReady)return 0;
  uint64_t total=0;
  File dir=SD.open(SPOOL_DIR);
  if(!dir||!dir.isDirectory())return 0;
  File entry=dir.openNextFile();
  while(entry){if(!entry.isDirectory())total+=entry.size();entry.close();entry=dir.openNextFile();}
  dir.close();
  return total;
}

String oldestSpoolPath(bool allowCurrent){
  if(!sdReady)return String();
  String oldest;
  File dir=SD.open(SPOOL_DIR);
  if(!dir||!dir.isDirectory())return oldest;
  File entry=dir.openNextFile();
  while(entry){
    if(!entry.isDirectory()){
      String name=String(entry.name());
      if(name.endsWith(".jsonl")&&(allowCurrent||name!=currentSpoolPath)){
        if(oldest.length()==0||name.compareTo(oldest)<0)oldest=name;
      }
    }
    entry.close();entry=dir.openNextFile();
  }
  dir.close();
  return oldest;
}

void pruneSpool(){
  if(!sdReady)return;
  const uint64_t quota=sdSpoolQuotaBytes();
  const uint64_t reserve=(SD.totalBytes()*static_cast<uint64_t>(SD_RESERVE_PERCENT))/100ULL;
  for(int guard=0;guard<64;guard++){
    const uint64_t used=spoolUsageBytes();
    const uint64_t total=SD.totalBytes();
    const uint64_t freeBytes=total>SD.usedBytes()?total-SD.usedBytes():0;
    if(used<=quota&&freeBytes>=reserve)return;
    String victim=oldestSpoolPath(false);
    if(victim.length()==0)victim=oldestSpoolPath(true);
    if(victim.length()==0)return;
    if(SD.remove(victim)){sdDroppedPackets+=1;if(victim==currentSpoolPath){currentSpoolPath="";currentSpoolRecords=0;}Serial.printf("KINGMAST: SD spool pruned %s\n",victim.c_str());}
    else return;
  }
}

String makeSpoolSegmentPath(uint64_t timestampMs,uint32_t packetSequence){
  char path[96];
  snprintf(path,sizeof(path),"%s/%020llu-%010lu.jsonl",SPOOL_DIR,static_cast<unsigned long long>(timestampMs),static_cast<unsigned long>(packetSequence));
  return String(path);
}

bool spoolHistoryRecord(const String& body,const String& signature,uint32_t packetSequence,uint64_t timestampMs){
  if(!sdReady||!historyUrlConfigured())return false;
  String line="{\"keyId\":\"";
  line+=deviceHmacConfigured()?String(KINGMAST_DEVICE_KEY_ID):String();
  line+="\",\"packet\":";line+=body;line+=",\"signature\":\"";line+=signature;line+="\"}";
  if(line.length()+1>SD_SPOOL_SEGMENT_BYTES){Serial.println("KINGMAST: history packet exceeds SD spool segment bound");sdDroppedPackets+=1;return false;}
  if(currentSpoolPath.length()==0){currentSpoolPath=makeSpoolSegmentPath(timestampMs,packetSequence);currentSpoolRecords=0;}
  File existing=SD.open(currentSpoolPath,FILE_READ);
  size_t currentBytes=existing?existing.size():0;if(existing)existing.close();
  if(currentBytes+line.length()+1>SD_SPOOL_SEGMENT_BYTES||currentSpoolRecords>=SD_SPOOL_SEGMENT_MAX_RECORDS){currentSpoolPath=makeSpoolSegmentPath(timestampMs,packetSequence);currentSpoolRecords=0;}
  File file=SD.open(currentSpoolPath,FILE_APPEND);
  if(!file){Serial.println("KINGMAST: failed to open SD spool segment");return false;}
  const size_t written=file.println(line);file.flush();file.close();
  if(written==0){Serial.println("KINGMAST: failed to write SD spool record");return false;}
  currentSpoolRecords+=1;sdSpooledPackets+=1;pruneSpool();return true;
}

bool parseRadarCsv(const String& line,RadarTrack& track){int p1=line.indexOf(',');int p2=line.indexOf(',',p1+1);int p3=line.indexOf(',',p2+1);int p4=line.indexOf(',',p3+1);if(p1<1||p2<0||p3<0||p4<0)return false;track.id=line.substring(0,p1);track.distanceM=line.substring(p1+1,p2).toFloat();track.bearingDeg=line.substring(p2+1,p3).toFloat();track.relativeSpeedMps=line.substring(p3+1,p4).toFloat();track.confidence=line.substring(p4+1).toFloat();track.valid=track.distanceM>=0.0f&&track.distanceM<=500.0f&&track.confidence>=0.0f&&track.confidence<=1.0f;return track.valid;}
void readSensors(){while(GpsSerial.available())gps.encode(GpsSerial.read());while(RadarSerial.available()){char c=static_cast<char>(RadarSerial.read());if(c=='\n'){RadarTrack parsed;if(parseRadarCsv(radarLine,parsed)){latestTrack=parsed;lastRadarSeenMs=millis();}radarLine="";}else if(c!='\r'&&radarLine.length()<180)radarLine+=c;}}

int postLiveBody(const String& body,const String& signature){
  if(!secureConfigurationValid()||WiFi.status()!=WL_CONNECTED)return -1;
  WiFiClientSecure tlsClient;tlsClient.setCACert(KINGMAST_TLS_CA_CERT);
  HTTPClient http;
  if(!http.begin(tlsClient,KINGMAST_API_URL))return -1;
  http.addHeader("Content-Type","application/json");
  if(edgeTokenConfigured())http.addHeader("x-kingmast-edge-token",KINGMAST_EDGE_TOKEN);
  if(deviceHmacConfigured()){
    if(signature.length()!=64){http.end();Serial.println("KINGMAST: failed to create device packet signature");return -1;}
    http.addHeader("x-kingmast-device-key-id",KINGMAST_DEVICE_KEY_ID);
    http.addHeader("x-kingmast-device-signature",signature);
  }
  http.setTimeout(1200);
  const int status=http.POST(body);http.end();return status;
}

bool shouldSpoolStatus(int status){return status<=0||status==408||status==425||status==429||status>=500;}

bool buildHistoryBatch(const String& path,String& batch){
  File file=SD.open(path,FILE_READ);if(!file)return false;
  batch="{\"records\":[";uint16_t count=0;
  while(file.available()){
    String line=file.readStringUntil('\n');line.trim();if(line.length()==0)continue;
    if(count>=SD_SPOOL_SEGMENT_MAX_RECORDS||batch.length()+line.length()+4>240000){file.close();return false;}
    if(count>0)batch+=',';batch+=line;count+=1;
  }
  file.close();batch+="]}";return count>0;
}

bool postHistoryBatch(const String& batch){
  if(WiFi.status()!=WL_CONNECTED||!historyUrlConfigured())return false;
  WiFiClientSecure tlsClient;tlsClient.setCACert(KINGMAST_TLS_CA_CERT);
  HTTPClient http;if(!http.begin(tlsClient,KINGMAST_HISTORY_URL))return false;
  http.addHeader("Content-Type","application/json");if(edgeTokenConfigured())http.addHeader("x-kingmast-edge-token",KINGMAST_EDGE_TOKEN);
  http.setTimeout(2500);const int status=http.POST(batch);http.end();return status>=200&&status<300;
}

void drainOldestSpoolSegment(){
  if(!sdReady||WiFi.status()!=WL_CONNECTED||!historyUrlConfigured())return;
  String path=oldestSpoolPath(true);if(path.length()==0)return;
  String batch;if(!buildHistoryBatch(path,batch)){Serial.printf("KINGMAST: invalid SD spool segment retained %s\n",path.c_str());return;}
  if(!postHistoryBatch(batch))return;
  if(SD.remove(path)){if(path==currentSpoolPath){currentSpoolPath="";currentSpoolRecords=0;}sdRecoveredSegments+=1;Serial.printf("KINGMAST: recovered SD history segment %s\n",path.c_str());}
}

void publishFrame(){
  uint64_t nowEpoch=epochMillis();
  if(nowEpoch==0){if(WiFi.status()!=WL_CONNECTED)connectWifi();if(!syncClock())return;nowEpoch=epochMillis();if(nowEpoch==0)return;}
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

  String body;serializeJson(doc,body);
  const String signature=devicePacketSignature(body,packetSequence,nowEpoch);
  if(WiFi.status()!=WL_CONNECTED)connectWifi();
  const int status=WiFi.status()==WL_CONNECTED?postLiveBody(body,signature):-1;
  const bool accepted=status>=200&&status<300;
  if(!accepted&&shouldSpoolStatus(status)){
    if(!spoolHistoryRecord(body,signature,packetSequence,nowEpoch))Serial.printf("KINGMAST: realtime unavailable and packet not spooled status=%d\n",status);
  }
  if(accepted&&sdReady&&millis()-lastHistoryDrainMs>=HISTORY_DRAIN_INTERVAL_MS){lastHistoryDrainMs=millis();drainOldestSpoolSegment();}
}

void setup(){
  Serial.begin(115200);
  if(!secureConfigurationValid())Serial.println("KINGMAST: secure edge publishing disabled until config.h is provisioned");
  initBootId();
  sdReady=initSdSpool();
  GpsSerial.begin(GPS_BAUD,SERIAL_8N1,GPS_RX_PIN,GPS_TX_PIN);
  RadarSerial.begin(RADAR_BAUD,SERIAL_8N1,RADAR_RX_PIN,RADAR_TX_PIN);
  connectWifi();syncClock();
}

void loop(){readSensors();unsigned long now=millis();if(now-lastPublishMs>=PUBLISH_INTERVAL_MS){lastPublishMs=now;publishFrame();}delay(2);}
