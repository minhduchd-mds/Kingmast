export type DriverAttentionState='attentive'|'distracted'|'prolonged-distraction'|'drowsiness-suspected'|'driver-unavailable';
export interface DriverMonitoringSample{
  timestampMs:number;
  faceDetected:boolean;
  eyesClosed:boolean;
  gazeAway:boolean;
  headYawDeg:number;
  headPitchDeg:number;
  confidence:number;
}
export interface DriverMonitoringAssessment{
  state:DriverAttentionState;
  confidence:number;
  attentionScore:number;
  perclos:number;
  gazeAwayRatio:number;
  faceAvailability:number;
  maxEyesClosedMs:number;
  maxGazeAwayMs:number;
  reason:string;
  storesRawVideo:false;
  advisoryOnly:true;
}

const MIN_RELIABLE_CONFIDENCE=.55;
const MIN_RELIABLE_COVERAGE=.5;
const MIN_VISIBLE_SAMPLES=3;
const MIN_TEMPORAL_SPAN_MS=1_500;
const MAX_SAMPLE_GAP_MS=2_200;
const SUSPECTED_MICROSLEEP_MS=1_800;
const PROLONGED_GAZE_AWAY_MS=3_500;
const DISTRACTED_GAZE_AWAY_MS=1_500;
function clamp01(value:number){return Math.max(0,Math.min(1,value));}
function unavailable(reason:string,confidence=0,faceAvailability=0):DriverMonitoringAssessment{return{state:'driver-unavailable',confidence:Number(clamp01(confidence).toFixed(2)),attentionScore:0,perclos:0,gazeAwayRatio:0,faceAvailability:Number(clamp01(faceAvailability).toFixed(2)),maxEyesClosedMs:0,maxGazeAwayMs:0,reason,storesRawVideo:false,advisoryOnly:true};}
function longestSpanMs(samples:DriverMonitoringSample[],predicate:(sample:DriverMonitoringSample)=>boolean){
  let longest=0;let startedAt:number|null=null;let previousAt:number|null=null;
  for(const sample of samples){
    if(predicate(sample)){
      if(startedAt===null||previousAt===null||sample.timestampMs-previousAt>MAX_SAMPLE_GAP_MS)startedAt=sample.timestampMs;
      longest=Math.max(longest,sample.timestampMs-startedAt);
      previousAt=sample.timestampMs;
    }else{startedAt=null;previousAt=null;}
  }
  return longest;
}

export function assessDriverMonitoring(samples:DriverMonitoringSample[]):DriverMonitoringAssessment{
  if(samples.length<3)return unavailable('insufficient-temporal-window');
  const ordered=[...samples].sort((a,b)=>a.timestampMs-b.timestampMs);
  const first=ordered[0]!;const last=ordered[ordered.length-1]!;
  const durationMs=Math.max(0,last.timestampMs-first.timestampMs);
  if(durationMs<MIN_TEMPORAL_SPAN_MS)return unavailable('insufficient-temporal-span');
  for(let index=1;index<ordered.length;index++){
    const gap=ordered[index]!.timestampMs-ordered[index-1]!.timestampMs;
    if(gap<=0||gap>MAX_SAMPLE_GAP_MS)return unavailable('cabin-observation-discontinuous');
  }
  const valid=ordered.filter((item)=>item.confidence>=MIN_RELIABLE_CONFIDENCE);
  const reliableCoverage=valid.length/ordered.length;
  if(valid.length===0)return unavailable('no-reliable-cabin-observation');
  if(reliableCoverage<MIN_RELIABLE_COVERAGE)return unavailable('cabin-observation-quality-low',reliableCoverage);
  const faceAvailability=valid.filter((item)=>item.faceDetected).length/valid.length;
  const visible=valid.filter((item)=>item.faceDetected);
  if(faceAvailability<.35||visible.length<MIN_VISIBLE_SAMPLES)return unavailable('driver-face-unavailable',1-faceAvailability,faceAvailability);

  const visibleWeight=visible.reduce((sum,item)=>sum+item.confidence,0);
  const attentionAway=(item:DriverMonitoringSample)=>item.gazeAway||Math.abs(item.headYawDeg)>35||Math.abs(item.headPitchDeg)>28;
  const perclos=visibleWeight>0?visible.reduce((sum,item)=>sum+(item.eyesClosed?item.confidence:0),0)/visibleWeight:0;
  const gazeAwayRatio=visibleWeight>0?visible.reduce((sum,item)=>sum+(attentionAway(item)?item.confidence:0),0)/visibleWeight:0;
  const avgConfidence=valid.reduce((sum,item)=>sum+item.confidence,0)/valid.length;
  const assessmentConfidence=avgConfidence*reliableCoverage*Math.max(.5,faceAvailability);
  const maxEyesClosedMs=longestSpanMs(visible,(item)=>item.eyesClosed);
  const maxGazeAwayMs=longestSpanMs(visible,attentionAway);
  const fatiguePressure=Math.max(perclos,clamp01(maxEyesClosedMs/3_000));
  const distractionPressure=Math.max(gazeAwayRatio,clamp01(maxGazeAwayMs/5_000));
  const attentionScore=clamp01(1-(.45*fatiguePressure+.4*distractionPressure+.15*(1-faceAvailability)));

  let state:DriverAttentionState='attentive';let reason='attention-within-thresholds';
  if(maxEyesClosedMs>=SUSPECTED_MICROSLEEP_MS||(durationMs>=8_000&&perclos>=.42)){state='drowsiness-suspected';reason=maxEyesClosedMs>=SUSPECTED_MICROSLEEP_MS?'sustained-eye-closure-event':'sustained-eye-closure-pattern';}
  else if(maxGazeAwayMs>=PROLONGED_GAZE_AWAY_MS||(durationMs>=4_000&&gazeAwayRatio>=.7)){state='prolonged-distraction';reason='sustained-road-gaze-away';}
  else if(maxGazeAwayMs>=DISTRACTED_GAZE_AWAY_MS||(durationMs>=1_500&&gazeAwayRatio>=.45)){state='distracted';reason='attention-away-from-road';}
  return{state,confidence:Number(clamp01(assessmentConfidence).toFixed(2)),attentionScore:Number(attentionScore.toFixed(2)),perclos:Number(perclos.toFixed(2)),gazeAwayRatio:Number(gazeAwayRatio.toFixed(2)),faceAvailability:Number(faceAvailability.toFixed(2)),maxEyesClosedMs,maxGazeAwayMs,reason,storesRawVideo:false,advisoryOnly:true};
}
