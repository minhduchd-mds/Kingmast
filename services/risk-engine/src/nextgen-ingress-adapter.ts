import type { CameraDetectionFrame } from '@kingmast/contracts';
import type { DriverStateObservation } from '@kingmast/contracts/nextgen';
import { NextgenRuntime } from './nextgen-runtime.js';

export interface LegacyDmsSample {
  timestampMs:number;
  faceDetected:boolean;
  eyesClosed:boolean;
  gazeAway:boolean;
  headYawDeg:number;
  headPitchDeg:number;
  confidence:number;
}

export function adaptLegacyDmsSample(sample:LegacyDmsSample):DriverStateObservation{
  return{observedAtMs:sample.timestampMs,faceDetected:sample.faceDetected,eyesClosed:sample.eyesClosed,gazeAway:sample.gazeAway,headYawDeg:sample.headYawDeg,headPitchDeg:sample.headPitchDeg,confidence:sample.confidence};
}

export function ingestLegacyDms(runtime:NextgenRuntime,sample:LegacyDmsSample,nowMs=Date.now()){
  return runtime.ingestDriverObservation(adaptLegacyDmsSample(sample),nowMs);
}

export function ingestLegacyFrontCamera(runtime:NextgenRuntime,vehicleId:string,frame:CameraDetectionFrame,receivedAtMs=Date.now()){
  return runtime.ingestPerception({
    vehicleId,
    frameId:`legacy-camera:${frame.cameraId}:${frame.timestampMs}`,
    mode:'live-edge',
    capturedAtMs:frame.timestampMs,
    receivedAtMs,
    cameras:[{cameraId:frame.cameraId,mount:'front',calibration:'degraded',synchronized:false,frameAgeMs:Math.max(0,receivedAtMs-frame.timestampMs),reprojectionErrorPx:null,health:'degraded'}],
    objects:frame.detections.map((detection)=>({id:`camera:${detection.id}`,kind:detection.kind==='obstacle'?'unknown':detection.kind,confidence:detection.confidence,distanceM:detection.estimatedDistanceM,relativeBearingDeg:Math.max(-180,Math.min(180,detection.bearingDeg)),relativeSpeedMps:null,position:null,firstSeenAtMs:detection.timestampMs,lastSeenAtMs:detection.timestampMs,sources:['camera']})),
    lanes:[],
    freeSpace:[],
  },receivedAtMs);
}
