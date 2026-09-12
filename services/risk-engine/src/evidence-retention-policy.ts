export type EvidenceClass='diagnostic'|'safety-summary'|'raw-sensor';
export type EvidenceRecord={id:string;class:EvidenceClass;createdAtMs:number;containsPreciseLocation:boolean;containsRawImage:boolean;containsHardwareSerial:boolean};
export type RetentionPolicy={nowMs:number;diagnosticMaxAgeMs:number;safetySummaryMaxAgeMs:number;rawSensorMaxAgeMs:number;rawSensorRetentionReviewed:boolean};
export type RetentionDecision={retain:boolean;reason:string;redactions:('precise-location'|'raw-image'|'hardware-serial')[]};

export function decideEvidenceRetention(record:EvidenceRecord,policy:RetentionPolicy):RetentionDecision{
  if(!record.id||![record.createdAtMs,policy.nowMs,policy.diagnosticMaxAgeMs,policy.safetySummaryMaxAgeMs,policy.rawSensorMaxAgeMs].every(Number.isFinite))return{retain:false,reason:'invalid-evidence',redactions:[]};
  if(record.createdAtMs>policy.nowMs)return{retain:false,reason:'future-evidence',redactions:[]};
  const redactions:RetentionDecision['redactions']=[];
  if(record.containsPreciseLocation)redactions.push('precise-location');
  if(record.containsRawImage)redactions.push('raw-image');
  if(record.containsHardwareSerial)redactions.push('hardware-serial');
  const age=policy.nowMs-record.createdAtMs;
  const maxAge=record.class==='diagnostic'?policy.diagnosticMaxAgeMs:record.class==='safety-summary'?policy.safetySummaryMaxAgeMs:policy.rawSensorMaxAgeMs;
  if(maxAge<0||age>maxAge)return{retain:false,reason:'retention-expired',redactions};
  if(record.class==='raw-sensor'&&!policy.rawSensorRetentionReviewed)return{retain:false,reason:'raw-retention-unreviewed',redactions};
  return{retain:true,reason:'within-reviewed-retention',redactions};
}
