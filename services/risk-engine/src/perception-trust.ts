import type { CameraNodeStatus,PerceptionFrame,PerceptionObjectTrack } from '@kingmast/contracts/nextgen';

const DEFAULT_MAX_FRAME_AGE_MS=1_000;
const DEFAULT_MAX_FUTURE_SKEW_MS=250;
const DEFAULT_MIN_OBJECT_CONFIDENCE=.35;
const SURROUND_MOUNTS=['front','rear','left','right'] as const;

export interface PerceptionTrustPolicy {
  maxFrameAgeMs:number;
  maxFutureSkewMs:number;
  minObjectConfidence:number;
  requireLiveEdgeForAlerts:boolean;
}

export interface PerceptionTrustResult {
  eligibleForAlerts:boolean;
  reasons:string[];
  objects:PerceptionObjectTrack[];
  surroundReady:boolean;
  uniqueCameraCount:number;
}

export const DEFAULT_PERCEPTION_TRUST_POLICY:PerceptionTrustPolicy={
  maxFrameAgeMs:DEFAULT_MAX_FRAME_AGE_MS,
  maxFutureSkewMs:DEFAULT_MAX_FUTURE_SKEW_MS,
  minObjectConfidence:DEFAULT_MIN_OBJECT_CONFIDENCE,
  requireLiveEdgeForAlerts:true,
};

function cameraUsable(camera:CameraNodeStatus){
  return camera.health!=='unavailable'&&camera.calibration==='calibrated'&&camera.synchronized&&camera.frameAgeMs!==null&&camera.frameAgeMs>=0&&camera.frameAgeMs<=DEFAULT_MAX_FRAME_AGE_MS;
}

function uniquePhysicalCameras(cameras:CameraNodeStatus[]){
  const byId=new Map<string,CameraNodeStatus>();
  for(const camera of cameras)if(camera.cameraId&&!byId.has(camera.cameraId))byId.set(camera.cameraId,camera);
  return [...byId.values()];
}

export function assessPerceptionTrust(frame:PerceptionFrame,nowMs=Date.now(),policy:PerceptionTrustPolicy=DEFAULT_PERCEPTION_TRUST_POLICY):PerceptionTrustResult{
  const reasons:string[]=[];
  const ageMs=nowMs-frame.capturedAtMs;
  if(frame.capturedAtMs>nowMs+policy.maxFutureSkewMs)reasons.push('future-frame');
  if(ageMs>policy.maxFrameAgeMs)reasons.push('stale-frame');
  if(ageMs< -policy.maxFutureSkewMs)reasons.push('invalid-frame-age');
  if(policy.requireLiveEdgeForAlerts&&frame.mode!=='live-edge')reasons.push(`mode-${frame.mode}-not-live`);
  if(frame.receivedAtMs<frame.capturedAtMs-policy.maxFutureSkewMs)reasons.push('received-before-capture');

  const cameras=uniquePhysicalCameras(frame.cameras);
  const usableCameras=cameras.filter(cameraUsable);
  const mountSet=new Set(usableCameras.map((camera)=>camera.mount));
  const surroundReady=SURROUND_MOUNTS.every((mount)=>mountSet.has(mount));
  if(frame.cameras.length!==cameras.length)reasons.push('duplicate-camera-id');

  const objects=frame.objects.filter((object)=>{
    if(!Number.isFinite(object.confidence)||object.confidence<policy.minObjectConfidence||object.confidence>1)return false;
    if(!Number.isFinite(object.lastSeenAtMs)||object.lastSeenAtMs>nowMs+policy.maxFutureSkewMs)return false;
    if(nowMs-object.lastSeenAtMs>policy.maxFrameAgeMs)return false;
    return object.sources.some((source)=>source==='camera'||source==='radar');
  });

  if(!usableCameras.length&&objects.some((object)=>object.sources.includes('camera')))reasons.push('camera-input-untrusted');
  return{
    eligibleForAlerts:reasons.length===0,
    reasons,
    objects,
    surroundReady,
    uniqueCameraCount:cameras.length,
  };
}
