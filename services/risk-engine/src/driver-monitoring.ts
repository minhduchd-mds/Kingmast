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

function clamp01(value:number){return Math.max(0,Math.min(1,value));}

export function assessDriverMonitoring(samples:DriverMonitoringSample[]):DriverMonitoringAssessment{
  if(samples.length<3)return{state:'attentive',confidence:0,perclos:0,gazeAwayRatio:0,faceAvailability:0,reason:'insufficient-temporal-window',storesRawVideo:false,advisoryOnly:true};
  const ordered=[...samples].sort((a,b)=>a.timestampMs-b.timestampMs);
  const first=ordered[0]!;const last=ordered[ordered.length-1]!;
  const durationMs=Math.max(1,last.timestampMs-first.timestampMs);
  const valid=ordered.filter((item)=>item.confidence>=.55);
  if(valid.length===0)return{state:'driver-unavailable',confidence:0,perclos:0,gazeAwayRatio:0,faceAvailability:0,reason:'no-reliable-cabin-observation',storesRawVideo:false,advisoryOnly:true};
  const faceAvailability=valid.filter((item)=>item.faceDetected).length/valid.length;
  const visible=valid.filter((item)=>item.faceDetected);
  if(faceAvailability<.35)return{state:'driver-unavailable',confidence:Number(clamp01(1-faceAvailability).toFixed(2)),perclos:0,gazeAwayRatio:0,faceAvailability:Number(faceAvailability.toFixed(2)),reason:'driver-face-unavailable',storesRawVideo:false,advisoryOnly:true};
  const denominator=Math.max(1,visible.length);
  const perclos=visible.filter((item)=>item.eyesClosed).length/denominator;
  const gazeAwayRatio=visible.filter((item)=>item.gazeAway||Math.abs(item.headYawDeg)>35||Math.abs(item.headPitchDeg)>28).length/denominator;
  const avgConfidence=valid.reduce((sum,item)=>sum+item.confidence,0)/valid.length;
  let state:DriverAttentionState='attentive';let reason='attention-within-thresholds';
  if(durationMs>=8_000&&perclos>=.42){state='drowsiness-suspected';reason='sustained-eye-closure-pattern';}
  else if(durationMs>=4_000&&gazeAwayRatio>=.7){state='prolonged-distraction';reason='sustained-road-gaze-away';}
  else if(durationMs>=1_500&&gazeAwayRatio>=.45){state='distracted';reason='attention-away-from-road';}
  return{state,confidence:Number(clamp01(avgConfidence).toFixed(2)),perclos:Number(perclos.toFixed(2)),gazeAwayRatio:Number(gazeAwayRatio.toFixed(2)),faceAvailability:Number(faceAvailability.toFixed(2)),reason,storesRawVideo:false,advisoryOnly:true};
}
