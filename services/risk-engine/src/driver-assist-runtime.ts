import type { DriverAssistAvailability,DriverAssistRuntimeSnapshot,SurroundRuntimeStatus } from '@kingmast/contracts';
import { assessLaneDeparture,type LaneDepartureAssessment,type LaneObservation } from './lane-departure.js';
import { assessDriverMonitoring,type DriverMonitoringAssessment,type DriverMonitoringSample } from './driver-monitoring.js';

export interface SurroundCameraObservation{
  cameraId:string;
  synchronized:boolean;
  calibrated:boolean;
  reprojectionErrorPx:number;
  frameSkewMs?:number;
  occluded?:boolean;
}
export interface SurroundObservation{
  timestampMs:number;
  cameras:SurroundCameraObservation[];
}

const LANE_LIVE_MS=1_200;
const LANE_STALE_MS=2_500;
const LANE_CONFIRM_WINDOW_MS=900;
const LANE_CAUTION_CONFIRMATIONS=2;
const DMS_LIVE_MS=1_500;
const DMS_STALE_MS=3_000;
const SURROUND_LIVE_MS=2_000;
const SURROUND_STALE_MS=4_000;
const DMS_WINDOW_MS=12_000;
const MAX_REPROJECTION_ERROR_PX=3;
const MAX_SURROUND_FRAME_SKEW_MS=80;
const MIN_SURROUND_CAMERAS=4;
const DMS_HARD_UNAVAILABLE_REASONS=new Set(['no-reliable-cabin-observation','driver-face-unavailable','cabin-observation-discontinuous']);
const DMS_DEGRADED_REASONS=new Set(['insufficient-temporal-window','insufficient-temporal-span','cabin-observation-quality-low']);

function ageOf(observedAtMs:number|undefined,nowMs:number){return observedAtMs===undefined?null:Math.max(0,nowMs-observedAtMs);}
function freshness(observedAtMs:number|undefined,nowMs:number,liveMs:number,staleMs:number):DriverAssistAvailability{
  if(observedAtMs===undefined)return'unavailable';
  const age=Math.max(0,nowMs-observedAtMs);
  if(age<=liveMs)return'live';
  if(age<=staleMs)return'degraded';
  return'unavailable';
}
function round2(value:number){return Number(Math.max(0,Math.min(1,value)).toFixed(2));}

export class DriverAssistRuntime{
  private latestLane?:{observation:LaneObservation;assessment:LaneDepartureAssessment};
  private laneHistory:Array<{timestampMs:number;assessment:LaneDepartureAssessment}>=[];
  private dmsSamples:DriverMonitoringSample[]=[];
  private latestDms?:DriverMonitoringAssessment;
  private latestDmsAtMs?:number;
  private latestSurround?:SurroundObservation;

  private stabilizeLane(observation:LaneObservation,assessment:LaneDepartureAssessment){
    const cutoff=observation.timestampMs-LANE_CONFIRM_WINDOW_MS;
    this.laneHistory=this.laneHistory.filter((item)=>item.timestampMs>=cutoff);
    this.laneHistory.push({timestampMs:observation.timestampMs,assessment});
    if(assessment.severity!=='caution'||assessment.side===null)return assessment;
    const confirmations=this.laneHistory.filter((item)=>item.assessment.side===assessment.side&&(item.assessment.severity==='caution'||item.assessment.severity==='critical')).length;
    if(confirmations>=LANE_CAUTION_CONFIRMATIONS)return assessment;
    return{...assessment,severity:'safe' as const,reason:'lane-departure-pending-confirmation'};
  }

  ingestLane(observation:LaneObservation){
    const assessment=this.stabilizeLane(observation,assessLaneDeparture(observation));
    this.latestLane={observation,assessment};
    return assessment;
  }

  ingestDriverMonitoring(sample:DriverMonitoringSample){
    const cutoff=sample.timestampMs-DMS_WINDOW_MS;
    this.dmsSamples=this.dmsSamples.filter((item)=>item.timestampMs>=cutoff);
    this.dmsSamples.push(sample);
    this.latestDms=assessDriverMonitoring(this.dmsSamples);
    this.latestDmsAtMs=sample.timestampMs;
    return this.latestDms;
  }

  ingestSurround(observation:SurroundObservation){
    this.latestSurround=observation;
    return this.buildSurroundStatus(observation.timestampMs);
  }

  private buildSurroundStatus(nowMs:number):SurroundRuntimeStatus{
    const sample=this.latestSurround;
    if(!sample)return{availability:'unavailable',observedAtMs:null,ageMs:null,cameraCount:0,calibratedCameraCount:0,synchronizedCameraCount:0,readyCameraCount:0,maxReprojectionErrorPx:null,calibrationUncertaintyPx:null,geometryConfidence:0,fullyReady:false,reason:'no-native-surround-observation',visualizationOnly:true};
    const ageMs=ageOf(sample.timestampMs,nowMs);
    const cameraCount=sample.cameras.length;
    const uniqueCameraCount=new Set(sample.cameras.map((camera)=>camera.cameraId)).size;
    const duplicateCameraCount=Math.max(0,cameraCount-uniqueCameraCount);
    const calibratedCameraCount=sample.cameras.filter((camera)=>camera.calibrated).length;
    const synchronizedCameraCount=sample.cameras.filter((camera)=>camera.synchronized).length;
    const occludedCameraCount=sample.cameras.filter((camera)=>camera.occluded===true).length;
    const maxReprojectionErrorPx=cameraCount?Math.max(...sample.cameras.map((camera)=>camera.reprojectionErrorPx)):null;
    const maxFrameSkewMs=cameraCount?Math.max(...sample.cameras.map((camera)=>Math.max(0,camera.frameSkewMs??0))):null;
    const readyCameraCount=sample.cameras.filter((camera)=>camera.calibrated&&camera.synchronized&&camera.occluded!==true&&camera.reprojectionErrorPx<=MAX_REPROJECTION_ERROR_PX&&(camera.frameSkewMs??0)<=MAX_SURROUND_FRAME_SKEW_MS).length;
    const fullyReady=cameraCount>=MIN_SURROUND_CAMERAS&&uniqueCameraCount===cameraCount&&readyCameraCount===cameraCount;
    const calibrationCoverage=cameraCount?calibratedCameraCount/cameraCount:0;
    const synchronizationCoverage=cameraCount?synchronizedCameraCount/cameraCount:0;
    const identityCoverage=cameraCount?uniqueCameraCount/cameraCount:0;
    const visibilityCoverage=cameraCount?(cameraCount-occludedCameraCount)/cameraCount:0;
    const reprojectionQuality=maxReprojectionErrorPx===null?0:Math.max(0,1-maxReprojectionErrorPx/(MAX_REPROJECTION_ERROR_PX*2));
    const skewQuality=maxFrameSkewMs===null?0:Math.max(0,1-maxFrameSkewMs/(MAX_SURROUND_FRAME_SKEW_MS*2));
    const geometryConfidence=round2(Math.min(calibrationCoverage,synchronizationCoverage,identityCoverage,visibilityCoverage,reprojectionQuality,skewQuality));
    const calibrationUncertaintyPx=maxReprojectionErrorPx===null?null:Number(maxReprojectionErrorPx.toFixed(2));
    const fresh=freshness(sample.timestampMs,nowMs,SURROUND_LIVE_MS,SURROUND_STALE_MS);
    let availability:DriverAssistAvailability=fresh;
    let reason='surround-calibration-ready';
    if(fresh==='live'&&!fullyReady){
      availability='degraded';
      if(cameraCount<MIN_SURROUND_CAMERAS)reason='surround-camera-coverage-incomplete';
      else if(duplicateCameraCount>0)reason='surround-camera-identity-duplicate';
      else if(occludedCameraCount>0)reason='surround-camera-occluded';
      else if((maxFrameSkewMs??0)>MAX_SURROUND_FRAME_SKEW_MS)reason='surround-frame-skew-exceeded';
      else reason='surround-calibration-incomplete';
    }
    else if(fresh==='degraded')reason='surround-observation-stale';
    else if(fresh==='unavailable')reason='surround-observation-unavailable';
    return{availability,observedAtMs:sample.timestampMs,ageMs,cameraCount,calibratedCameraCount,synchronizedCameraCount,readyCameraCount,maxReprojectionErrorPx,calibrationUncertaintyPx,geometryConfidence,fullyReady,reason,visualizationOnly:true};
  }

  snapshot(nowMs=Date.now(),assistantContextAvailable=false):DriverAssistRuntimeSnapshot{
    const laneAge=ageOf(this.latestLane?.observation.timestampMs,nowMs);
    let laneAvailability=freshness(this.latestLane?.observation.timestampMs,nowMs,LANE_LIVE_MS,LANE_STALE_MS);
    const laneAssessment=this.latestLane?.assessment;
    if(laneAvailability==='live'&&laneAssessment?.reason==='lane-model-not-reliable')laneAvailability='degraded';
    const ldw={
      availability:laneAvailability,
      observedAtMs:this.latestLane?.observation.timestampMs??null,
      ageMs:laneAge,
      severity:laneAssessment?.severity??'safe',
      side:laneAssessment?.side??null,
      timeToLineCrossingS:laneAssessment?.timeToLineCrossingS??null,
      confidence:laneAssessment?.confidence??0,
      reason:laneAssessment?.reason??'no-lane-observation',
      advisoryOnly:true as const,
    };

    const dmsAge=ageOf(this.latestDmsAtMs,nowMs);
    let dmsAvailability=freshness(this.latestDmsAtMs,nowMs,DMS_LIVE_MS,DMS_STALE_MS);
    if(dmsAvailability==='live'&&this.latestDms){
      if(DMS_HARD_UNAVAILABLE_REASONS.has(this.latestDms.reason))dmsAvailability='unavailable';
      else if(DMS_DEGRADED_REASONS.has(this.latestDms.reason)||this.latestDms.state==='driver-unavailable')dmsAvailability='degraded';
    }
    const dms={
      availability:dmsAvailability,
      observedAtMs:this.latestDmsAtMs??null,
      ageMs:dmsAge,
      state:this.latestDms?.state??'driver-unavailable',
      confidence:this.latestDms?.confidence??0,
      perclos:this.latestDms?.perclos??0,
      gazeAwayRatio:this.latestDms?.gazeAwayRatio??0,
      faceAvailability:this.latestDms?.faceAvailability??0,
      reason:this.latestDms?.reason??'no-cabin-observation',
      storesRawVideo:false as const,
      advisoryOnly:true as const,
    };

    const assistant={
      availability:(assistantContextAvailable?'live':'staged') as DriverAssistAvailability,
      observedAtMs:assistantContextAvailable?nowMs:null,
      ageMs:assistantContextAvailable?0:null,
      reason:assistantContextAvailable?'read-only-context-ready':'awaiting-live-vehicle-context',
      readOnly:true as const,
      actuatorTools:false as const,
    };

    return{generatedAtMs:nowMs,ldw,dms,assistant,surround:this.buildSurroundStatus(nowMs),controlAuthority:'none'};
  }
}
