import type {
  CameraDetection,
  CameraDetectionFrame,
  DetectedObject,
  ObjectKind,
  RadarTrack,
  RadarTrackFrame,
  RelativeZone,
  Severity,
  VehiclePosition,
} from '@kingmast/contracts';
import { projectPoint } from './geo.js';

const CAMERA_MAX_AGE_MS = 350;
const RADAR_MAX_AGE_MS = 250;
const MATCH_BEARING_DEG = 9;
const MATCH_DISTANCE_M = 8;

function angleDelta(a:number,b:number) { return Math.abs((((a-b)+540)%360)-180); }
function zoneForBearing(relativeBearingDeg:number):RelativeZone {
  const normalized=((relativeBearingDeg+540)%360)-180;
  if(normalized>=-18&&normalized<=18)return'front';
  if(normalized>18&&normalized<=55)return'front-right';
  if(normalized<-18&&normalized>=-55)return'front-left';
  if(normalized>55&&normalized<125)return'right';
  if(normalized<-55&&normalized>-125)return'left';
  return'rear';
}
function severityFor(kind:ObjectKind,distanceM:number,confidence:number):Severity {
  if(confidence<.55)return'safe';
  if(kind==='person'||kind==='bicycle'||kind==='motorcycle'){
    if(distanceM<=7)return'critical';
    if(distanceM<=16)return'caution';
  }
  if(distanceM<=8)return'critical';
  if(distanceM<=20)return'caution';
  return'safe';
}
function matchCamera(track:RadarTrack,detections:CameraDetection[]) {
  let best:CameraDetection|null=null;let bestScore=Number.POSITIVE_INFINITY;
  for(const detection of detections){
    const bearingScore=angleDelta(track.bearingDeg,detection.bearingDeg);if(bearingScore>MATCH_BEARING_DEG)continue;
    const distanceScore=detection.estimatedDistanceM===null?0:Math.abs(track.distanceM-detection.estimatedDistanceM);
    if(detection.estimatedDistanceM!==null&&distanceScore>MATCH_DISTANCE_M)continue;
    const score=bearingScore+distanceScore*.35;if(score<bestScore){best=detection;bestScore=score;}
  }
  return best;
}

export function fuseEdgePerception(input:{vehicle:VehiclePosition;camera?:CameraDetectionFrame;radar?:RadarTrackFrame;nowMs?:number;}):DetectedObject[] {
  const nowMs=input.nowMs??Date.now();
  const radarTracks=input.radar&&nowMs-input.radar.timestampMs<=RADAR_MAX_AGE_MS?input.radar.tracks:[];
  const cameraDetections=input.camera&&nowMs-input.camera.timestampMs<=CAMERA_MAX_AGE_MS?input.camera.detections:[];
  const usedCameraIds=new Set<string>();const objects:DetectedObject[]=[];
  for(const track of radarTracks){
    const detection=matchCamera(track,cameraDetections);if(detection)usedCameraIds.add(detection.id);
    const kind:ObjectKind=detection?.kind??'unknown';
    const confidence=Math.max(0,Math.min(1,detection?Math.sqrt(track.confidence*detection.confidence):track.confidence*.72));
    const relativeBearing=((track.bearingDeg+540)%360)-180;
    const worldBearing=(input.vehicle.headingDeg+relativeBearing+360)%360;
    objects.push({id:`fused-${track.id}`,kind,confidence,distanceM:track.distanceM,bearingDeg:worldBearing,zone:zoneForBearing(relativeBearing),severity:severityFor(kind,track.distanceM,confidence),relativeSpeedMps:track.relativeSpeedMps,position:projectPoint(input.vehicle,worldBearing,track.distanceM),timestampMs:Math.max(track.timestampMs,detection?.timestampMs??0),source:detection?'radar-camera':'radar-only'});
  }
  for(const detection of cameraDetections){
    if(usedCameraIds.has(detection.id)||detection.estimatedDistanceM===null||detection.confidence<.72)continue;
    const relativeBearing=((detection.bearingDeg+540)%360)-180;const worldBearing=(input.vehicle.headingDeg+relativeBearing+360)%360;const distanceM=detection.estimatedDistanceM;
    objects.push({id:`camera-${detection.id}`,kind:detection.kind,confidence:detection.confidence*.75,distanceM,bearingDeg:worldBearing,zone:zoneForBearing(relativeBearing),severity:severityFor(detection.kind,distanceM,detection.confidence*.75),relativeSpeedMps:0,position:projectPoint(input.vehicle,worldBearing,distanceM),timestampMs:detection.timestampMs,source:'camera-only'});
  }
  return objects.sort((a,b)=>a.distanceM-b.distanceM).slice(0,64);
}
