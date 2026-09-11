import type { CalibratedCameraObservation,FreeSpaceSector } from '@kingmast/contracts/nextgen';
import type { VisionFreeSpaceSnapshot } from '@kingmast/contracts/vision-nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';

const MAX_AGE_MS=1_000;
const MIN_CONFIDENCE=.55;

function unavailable(reason:VisionFreeSpaceSnapshot['reason'],observedAtMs:number|null=null,sourceCameraIds:string[]=[]):VisionFreeSpaceSnapshot{return{available:false,confidence:0,forwardClearanceM:null,minimumClearanceM:null,sectorCount:0,observedAtMs,sourceCameraIds,reason,visualizationOnly:true};}
function validSector(sector:FreeSpaceSector){return Number.isFinite(sector.bearingStartDeg)&&Number.isFinite(sector.bearingEndDeg)&&Number.isFinite(sector.freeDistanceM)&&sector.freeDistanceM>=0&&sector.freeDistanceM<=250&&sector.confidence>=MIN_CONFIDENCE;}
function overlapsForward(sector:FreeSpaceSector){const start=Math.min(sector.bearingStartDeg,sector.bearingEndDeg),end=Math.max(sector.bearingStartDeg,sector.bearingEndDeg);return start<=35&&end>=-35;}

export function estimateVisionFreeSpace(observations:CalibratedCameraObservation[],calibrations:CameraCalibrationRegistry,nowMs=Date.now()):VisionFreeSpaceSnapshot{
  const external=calibrations.list().filter((item)=>item.mount!=='cabin');
  if(!external.length)return unavailable('camera-unavailable');
  const ids=new Set(external.map((item)=>item.cameraId));
  const present=observations.filter((item)=>ids.has(item.cameraId));
  if(!present.length)return unavailable('camera-unavailable',null,[...ids]);
  const fresh=present.filter((item)=>nowMs-item.capturedAtMs>=-250&&nowMs-item.capturedAtMs<=MAX_AGE_MS);
  if(!fresh.length)return unavailable('stale',Math.max(...present.map((item)=>item.capturedAtMs)),present.map((item)=>item.cameraId));
  const sectors=fresh.flatMap((item)=>item.freeSpace.filter(validSector).map((sector)=>({sector,cameraId:item.cameraId,capturedAtMs:item.capturedAtMs})));
  if(!sectors.length){
    const anyReported=fresh.some((item)=>item.freeSpace.length>0);
    return unavailable(anyReported?'low-confidence':'no-valid-sector',Math.max(...fresh.map((item)=>item.capturedAtMs)),fresh.map((item)=>item.cameraId));
  }
  const forward=sectors.filter((item)=>overlapsForward(item.sector));
  const minimumClearanceM=Math.min(...sectors.map((item)=>item.sector.freeDistanceM));
  const forwardClearanceM=forward.length?Math.min(...forward.map((item)=>item.sector.freeDistanceM)):null;
  const confidence=sectors.reduce((sum,item)=>sum+item.sector.confidence,0)/sectors.length;
  return{available:true,confidence,forwardClearanceM,minimumClearanceM,sectorCount:sectors.length,observedAtMs:Math.max(...sectors.map((item)=>item.capturedAtMs)),sourceCameraIds:[...new Set(sectors.map((item)=>item.cameraId))].sort(),reason:'stable',visualizationOnly:true};
}
