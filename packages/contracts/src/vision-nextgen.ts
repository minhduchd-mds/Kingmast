import type { TrafficSignalState } from './nextgen.js';

export interface VisionLaneSnapshot {
  available:boolean;
  confidence:number;
  leftBoundaryM:number|null;
  rightBoundaryM:number|null;
  laneWidthM:number|null;
  curvature1pm:number|null;
  observedAtMs:number|null;
  sourceCameraIds:string[];
  reason:'stable'|'camera-unavailable'|'stale'|'low-confidence'|'boundaries-incomplete';
  advisoryOnly:true;
}

export interface VisionFreeSpaceSnapshot {
  available:boolean;
  confidence:number;
  forwardClearanceM:number|null;
  minimumClearanceM:number|null;
  sectorCount:number;
  observedAtMs:number|null;
  sourceCameraIds:string[];
  reason:'stable'|'camera-unavailable'|'stale'|'low-confidence'|'no-valid-sector';
  visualizationOnly:true;
}

export interface VisionTrafficControlSnapshot {
  speedLimitKmh:number|null;
  speedLimitConfidence:number;
  signalState:TrafficSignalState|null;
  signalConfidence:number;
  stopSignDistanceM:number|null;
  yieldSignDistanceM:number|null;
  observedAtMs:number|null;
  sourceCameraIds:string[];
  degradedReasons:string[];
  advisoryOnly:true;
}

export interface VisionSceneSnapshot {
  generatedAtMs:number;
  lane:VisionLaneSnapshot;
  freeSpace:VisionFreeSpaceSnapshot;
  trafficControls:VisionTrafficControlSnapshot;
  freshnessMs:number|null;
  advisoryOnly:true;
  controlAuthority:'none';
}
