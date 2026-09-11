import type { CalibratedCameraObservation,CameraMount,SurroundFusionSnapshot } from '@kingmast/contracts/nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';
import {associateCrossCameraTracks} from './cross-camera-association.js';

const REQUIRED_MOUNTS:CameraMount[]=['front','rear','left','right'];
const MAX_CAMERA_AGE_MS=350;
const MAX_SYNC_SPREAD_MS=120;

export function buildSurroundFusion(input:{vehicleId:string;observations:CalibratedCameraObservation[];calibrations:CameraCalibrationRegistry;nowMs?:number}):SurroundFusionSnapshot{
  const nowMs=input.nowMs??Date.now();
  const degradedReasons:string[]=[];
  const uniqueByCamera=new Map(input.observations.slice(0,8).map((item)=>[item.cameraId,item]));
  if(uniqueByCamera.size!==Math.min(input.observations.length,8))degradedReasons.push('duplicate-camera-observation');
  const readyMounts:CameraMount[]=[];
  const accepted:CalibratedCameraObservation[]=[];
  for(const observation of uniqueByCamera.values()){
    const calibration=input.calibrations.get(observation.cameraId);
    if(!calibration){degradedReasons.push(`calibration-missing:${observation.cameraId}`);continue;}
    const age=nowMs-observation.capturedAtMs;
    if(age< -100||age>MAX_CAMERA_AGE_MS){degradedReasons.push(`camera-stale:${observation.cameraId}`);continue;}
    if(observation.receivedAtMs<observation.capturedAtMs){degradedReasons.push(`camera-clock-invalid:${observation.cameraId}`);continue;}
    readyMounts.push(calibration.mount);accepted.push(observation);
  }
  const uniqueMounts=[...new Set(readyMounts)];
  const missingMounts=REQUIRED_MOUNTS.filter((mount)=>!uniqueMounts.includes(mount));
  const timestamps=accepted.map((item)=>item.capturedAtMs);
  const syncSpread=timestamps.length?Math.max(...timestamps)-Math.min(...timestamps):Number.POSITIVE_INFINITY;
  const synchronized=accepted.length>1&&syncSpread<=MAX_SYNC_SPREAD_MS;
  if(!synchronized)degradedReasons.push('camera-sync-not-ready');
  if(missingMounts.length)degradedReasons.push(`missing-mounts:${missingMounts.join(',')}`);
  const calibrationErrors=accepted.map((item)=>input.calibrations.get(item.cameraId)?.reprojectionErrorPx??3);
  const geometryConfidence=accepted.length?Math.max(0,Math.min(1,1-(calibrationErrors.reduce((sum,value)=>sum+value,0)/accepted.length)/3)):0;
  if(geometryConfidence<.55)degradedReasons.push('geometry-confidence-low');
  const fullyReady=missingMounts.length===0&&synchronized&&geometryConfidence>=.55;
  const objects=associateCrossCameraTracks(accepted.flatMap((item)=>item.detections));
  return{vehicleId:input.vehicleId,generatedAtMs:nowMs,availability:fullyReady?'live':accepted.length?'degraded':'unavailable',uniqueCameraCount:accepted.length,readyMounts:uniqueMounts,missingMounts,synchronized,geometryConfidence,objects,degradedReasons:[...new Set(degradedReasons)],visualizationOnly:true};
}
