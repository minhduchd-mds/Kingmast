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
  perclos:number;
  gazeAwayRatio:number;
  faceAvailability:number;
  reason:string;
  storesRawVideo:false;
  advisoryOnly:true;
}

const MIN_RELIABLE_CONFIDENCE=.55;
const MIN_RELIABLE_COVERAGE=.5;
const MIN_VISIBLE_SAMPLES=3;
function clamp01(value:number){return Math.max(0,Math.min(1,value));}
function unavailable(reason:string,confidence=0,faceAvailability=0):DriverMonitoringAssessment{return{state:'driver-unavailable',confidence:Number(clamp01(confidence).toFixed(2)),perclos:0,gazeAwayRatio:0,faceAvailability:Number(clamp01(faceAvailability).toFixed(2)),reason,storesRawVideo:false,advisoryOnly:true};}

export function assessDriverMonitoring(samples:DriverMonitoringSample[]):DriverMonitoringAssessment{
  if(samples.length<3)return unavailable('insufficient-temporal-window');
  const ordered=[...samples].sort((a,b)=>a.timestampMs-b.timestampMs);
  const first=ordered[0]!;const last=ordered[ordered.length-1]!;
  const durationMs=Math.max(1,last.timestampMs-first.timestampMs);
  const valid=ordered.filter((item)=>item.confidence>=MIN_RELIABLE_CONFIDENCE);
  const reliableCoverage=valid.length/ordered.length;
  if(valid.length===0)return unavailable('no-reliable-cabin-observation');
  if(reliableCoverage<MIN_RELIABLE_COVERAGE)return unavailable('cabin-observation-quality-low',reliableCoverage);
  const faceAvailability=valid.filter((item)=>item.faceDetected).length/valid.length;
  const visible=valid.filter((item)=>item.faceDetected);
  if(faceAvailability<.35||visible.length<MIN_VISIBLE_SAMPLES)return unavailable('driver-face-unavailable',1-faceAvailability,faceAvailability);

  const visibleWeight=visible.reduce((sum,item)=>sum+item.confidence,0);
  const perclos=visibleWeight>0?visible.reduce((sum,item)=>sum+(item.eyesClosed?item.confidence:0),0)/visibleWeight:0;
  const gazeAwayRatio=visibleWeight>0?visible.reduce((sum,item)=>sum+((item.gazeAway||Math.abs(item.headYawDeg)>35||Math.abs(item.headPitchDeg)>28)?item.confidence:0),0)/visibleWeight:0;
  const avgConfidence=valid.reduce((sum,item)=>sum+item.confidence,0)/valid.length;
  const assessmentConfidence=avgConfidence*reliableCoverage*Math.max(.5,faceAvailability);
  let state:DriverAttentionState='attentive';let reason='attention-within-thresholds';
  if(durationMs>=8_000&&perclos>=.42){state='drowsiness-suspected';reason='sustained-eye-closure-pattern';}
  else if(durationMs>=4_000&&gazeAwayRatio>=.7){state='prolonged-distraction';reason='sustained-road-gaze-away';}
  else if(durationMs>=1_500&&gazeAwayRatio>=.45){state='distracted';reason='attention-away-from-road';}
  return{state,confidence:Number(clamp01(assessmentConfidence).toFixed(2)),perclos:Number(perclos.toFixed(2)),gazeAwayRatio:Number(gazeAwayRatio.toFixed(2)),faceAvailability:Number(faceAvailability.toFixed(2)),reason,storesRawVideo:false,advisoryOnly:true};
}
