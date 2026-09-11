import type { CalibratedCameraObservation,LanePerception } from '@kingmast/contracts/nextgen';
import type { VisionLaneSnapshot } from '@kingmast/contracts/vision-nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';

const MAX_AGE_MS=1_000;
const MIN_CONFIDENCE=.6;

function unavailable(reason:VisionLaneSnapshot['reason'],observedAtMs:number|null=null,sourceCameraIds:string[]=[]):VisionLaneSnapshot{return{available:false,confidence:0,leftBoundaryM:null,rightBoundaryM:null,laneWidthM:null,curvature1pm:null,observedAtMs,sourceCameraIds,reason,advisoryOnly:true};}
function boundary(lanes:LanePerception[],side:'left'|'right'){return lanes.filter((item)=>item.side===side&&item.distanceToBoundaryM!==null).sort((a,b)=>b.confidence-a.confidence||Math.abs(a.distanceToBoundaryM!)-Math.abs(b.distanceToBoundaryM!))[0]??null;}
function mean(values:number[]){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;}

export function estimateVisionLane(observations:CalibratedCameraObservation[],calibrations:CameraCalibrationRegistry,nowMs=Date.now()):VisionLaneSnapshot{
  const front=calibrations.byMount('front');
  if(!front)return unavailable('camera-unavailable');
  const observation=observations.find((item)=>item.cameraId===front.cameraId)??null;
  if(!observation)return unavailable('camera-unavailable',null,[front.cameraId]);
  const ageMs=nowMs-observation.capturedAtMs;
  if(ageMs< -250||ageMs>MAX_AGE_MS)return unavailable('stale',observation.capturedAtMs,[front.cameraId]);
  const lanes=observation.lanes.filter((item)=>item.confidence>=MIN_CONFIDENCE);
  if(!lanes.length)return unavailable(observation.lanes.length?'low-confidence':'boundaries-incomplete',observation.capturedAtMs,[front.cameraId]);
  const left=boundary(lanes,'left');
  const right=boundary(lanes,'right');
  if(!left||!right)return unavailable('boundaries-incomplete',observation.capturedAtMs,[front.cameraId]);
  const leftBoundaryM=Math.abs(left.distanceToBoundaryM!);
  const rightBoundaryM=Math.abs(right.distanceToBoundaryM!);
  const laneWidthM=leftBoundaryM+rightBoundaryM;
  if(laneWidthM<2||laneWidthM>6)return unavailable('boundaries-incomplete',observation.capturedAtMs,[front.cameraId]);
  const confidence=Math.min(left.confidence,right.confidence);
  const curvature1pm=mean([left.curvature1pm,right.curvature1pm].filter((value):value is number=>value!==null&&Number.isFinite(value)));
  return{available:true,confidence,leftBoundaryM,rightBoundaryM,laneWidthM,curvature1pm,observedAtMs:observation.capturedAtMs,sourceCameraIds:[front.cameraId],reason:'stable',advisoryOnly:true};
}
