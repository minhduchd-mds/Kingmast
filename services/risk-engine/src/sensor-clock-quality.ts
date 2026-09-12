export type ClockQualitySample={sensorId:string;observedAtMs:number;offsetMs:number;jitterMs:number;monotonic:boolean;syncSource:'ptp'|'gnss'|'host'|'unknown'};
export type ClockQualityPolicy={maxAgeMs:number;maxOffsetMs:number;maxJitterMs:number;trustedSources:readonly ('ptp'|'gnss'|'host')[]};
export type ClockQualityAssessment={status:'trusted'|'degraded'|'unavailable';reason:string;crossSensorFusionAllowed:boolean};

export function assessSensorClockQuality(sample:ClockQualitySample|null,nowMs:number,policy:ClockQualityPolicy):ClockQualityAssessment{
 if(!sample)return{status:'unavailable',reason:'no-clock-evidence',crossSensorFusionAllowed:false};
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.maxOffsetMs<0||policy.maxJitterMs<0)return{status:'unavailable',reason:'invalid-policy',crossSensorFusionAllowed:false};
 const values=[sample.observedAtMs,sample.offsetMs,sample.jitterMs];
 if(sample.sensorId.length===0||values.some((value)=>!Number.isFinite(value))||sample.observedAtMs>nowMs||nowMs-sample.observedAtMs>policy.maxAgeMs)return{status:'unavailable',reason:'invalid-or-stale-clock-evidence',crossSensorFusionAllowed:false};
 if(!sample.monotonic)return{status:'unavailable',reason:'clock-not-monotonic',crossSensorFusionAllowed:false};
 if(sample.syncSource==='unknown'||!policy.trustedSources.includes(sample.syncSource))return{status:'degraded',reason:'sync-source-untrusted',crossSensorFusionAllowed:false};
 if(Math.abs(sample.offsetMs)>policy.maxOffsetMs||sample.jitterMs>policy.maxJitterMs)return{status:'degraded',reason:'clock-quality-outside-reviewed-bounds',crossSensorFusionAllowed:false};
 return{status:'trusted',reason:'clock-quality-within-reviewed-bounds',crossSensorFusionAllowed:true};
}
