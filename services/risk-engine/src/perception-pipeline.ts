import type { CameraNodeStatus,FreeSpaceSector,LanePerception,PerceptionFrame,PerceptionObjectTrack,RuntimeDataMode } from '@kingmast/contracts/nextgen';

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const finiteOrNull=(value:number|null)=>value===null||!Number.isFinite(value)?null:value;

export interface RawPerceptionInput {
  vehicleId:string;
  frameId:string;
  mode:RuntimeDataMode;
  capturedAtMs:number;
  receivedAtMs:number;
  cameras:CameraNodeStatus[];
  objects:PerceptionObjectTrack[];
  lanes:LanePerception[];
  freeSpace:FreeSpaceSector[];
}

function normalizeCamera(camera:CameraNodeStatus,receivedAtMs:number):CameraNodeStatus{
  const frameAgeMs=camera.frameAgeMs===null?null:Math.max(0,Math.round(camera.frameAgeMs));
  return{...camera,frameAgeMs,reprojectionErrorPx:finiteOrNull(camera.reprojectionErrorPx),health:camera.health, synchronized:Boolean(camera.synchronized)};
}

function normalizeTrack(track:PerceptionObjectTrack):PerceptionObjectTrack{
  return{
    ...track,
    confidence:clamp(track.confidence,0,1),
    distanceM:track.distanceM===null?null:Math.max(0,track.distanceM),
    relativeBearingDeg:track.relativeBearingDeg===null?null:clamp(track.relativeBearingDeg,-180,180),
    relativeSpeedMps:finiteOrNull(track.relativeSpeedMps),
    firstSeenAtMs:Math.min(track.firstSeenAtMs,track.lastSeenAtMs),
    lastSeenAtMs:Math.max(track.firstSeenAtMs,track.lastSeenAtMs),
    sources:[...new Set(track.sources)],
  };
}

function normalizeLane(lane:LanePerception):LanePerception{return{...lane,confidence:clamp(lane.confidence,0,1),curvature1pm:finiteOrNull(lane.curvature1pm),distanceToBoundaryM:lane.distanceToBoundaryM===null?null:Math.max(0,lane.distanceToBoundaryM)};}
function normalizeFreeSpace(sector:FreeSpaceSector):FreeSpaceSector{return{bearingStartDeg:clamp(sector.bearingStartDeg,-180,180),bearingEndDeg:clamp(sector.bearingEndDeg,-180,180),freeDistanceM:Math.max(0,sector.freeDistanceM),confidence:clamp(sector.confidence,0,1)};}

export function buildPerceptionFrame(input:RawPerceptionInput):PerceptionFrame{
  const degradedReasons:string[]=[];
  const cameraIds=new Set<string>();
  const mounts=new Set<string>();
  const cameras=input.cameras.slice(0,8).map((camera)=>{
    if(cameraIds.has(camera.cameraId))degradedReasons.push(`duplicate-camera-id:${camera.cameraId}`);
    cameraIds.add(camera.cameraId);
    if(camera.mount!=='cabin'&&mounts.has(camera.mount))degradedReasons.push(`duplicate-camera-mount:${camera.mount}`);
    mounts.add(camera.mount);
    if(camera.calibration!=='calibrated')degradedReasons.push(`camera-${camera.cameraId}-${camera.calibration}`);
    if(!camera.synchronized)degradedReasons.push(`camera-${camera.cameraId}-unsynchronized`);
    if(camera.health!=='ok')degradedReasons.push(`camera-${camera.cameraId}-${camera.health}`);
    return normalizeCamera(camera,input.receivedAtMs);
  });
  if(input.receivedAtMs<input.capturedAtMs)degradedReasons.push('received-before-captured');
  if(input.mode!=='live-edge')degradedReasons.push(`non-live-mode:${input.mode}`);
  return{
    vehicleId:input.vehicleId.slice(0,96),
    frameId:input.frameId.slice(0,128),
    mode:input.mode,
    capturedAtMs:input.capturedAtMs,
    receivedAtMs:input.receivedAtMs,
    cameras,
    objects:input.objects.slice(0,256).map(normalizeTrack),
    lanes:input.lanes.slice(0,16).map(normalizeLane),
    freeSpace:input.freeSpace.slice(0,72).map(normalizeFreeSpace),
    degradedReasons:[...new Set(degradedReasons)].slice(0,64),
  };
}
