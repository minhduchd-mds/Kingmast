export type GnssFix={observedAtMs:number;latitude:number;longitude:number;accuracyM:number;speedKmh:number|null;headingDeg:number|null};
export type GnssPolicy={maxAgeMs:number;maxAccuracyM:number;maxSpeedKmh:number};
export type GnssIntegrity={status:'trusted'|'degraded'|'rejected';reason:string;speedKmh:number|null;headingDeg:number|null};

const finite=(value:number)=>Number.isFinite(value);

export function assessGnssFix(fix:GnssFix,nowMs:number,policy:GnssPolicy):GnssIntegrity{
  if(!finite(nowMs)||!finite(policy.maxAgeMs)||!finite(policy.maxAccuracyM)||!finite(policy.maxSpeedKmh)||policy.maxAgeMs<0||policy.maxAccuracyM<=0||policy.maxSpeedKmh<=0)return{status:'rejected',reason:'invalid-policy',speedKmh:null,headingDeg:null};
  if(!finite(fix.observedAtMs)||!finite(fix.latitude)||!finite(fix.longitude)||!finite(fix.accuracyM))return{status:'rejected',reason:'non-finite-fix',speedKmh:null,headingDeg:null};
  if(fix.latitude<-90||fix.latitude>90||fix.longitude<-180||fix.longitude>180||fix.accuracyM<0)return{status:'rejected',reason:'invalid-position',speedKmh:null,headingDeg:null};
  if(fix.observedAtMs>nowMs)return{status:'rejected',reason:'future-fix',speedKmh:null,headingDeg:null};
  if(nowMs-fix.observedAtMs>policy.maxAgeMs)return{status:'rejected',reason:'stale-fix',speedKmh:null,headingDeg:null};
  if(fix.speedKmh!==null&&(!finite(fix.speedKmh)||fix.speedKmh<0||fix.speedKmh>policy.maxSpeedKmh))return{status:'degraded',reason:'implausible-speed',speedKmh:null,headingDeg:fix.headingDeg};
  if(fix.headingDeg!==null&&(!finite(fix.headingDeg)||fix.headingDeg<0||fix.headingDeg>=360))return{status:'degraded',reason:'invalid-heading',speedKmh:fix.speedKmh,headingDeg:null};
  if(fix.accuracyM>policy.maxAccuracyM)return{status:'degraded',reason:'poor-accuracy',speedKmh:fix.speedKmh,headingDeg:fix.headingDeg};
  return{status:'trusted',reason:'fresh-accurate-fix',speedKmh:fix.speedKmh,headingDeg:fix.headingDeg};
}
