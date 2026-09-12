export type SourceKind='radar'|'camera'|'can-readonly'|'gnss';
export type SourceTrust='trusted'|'degraded'|'unavailable';
export type SourceMeasurement={source:SourceKind;observedAtMs:number;trust:SourceTrust;confidence:number;value:number|null};
export type SourceArbitrationPolicy={maxAgeMs:number;minConfidence:number;preferredOrder:SourceKind[]};
export type SourceArbitration={source:SourceKind|null;value:number|null;status:'selected'|'degraded'|'unavailable';reason:string};

const trustRank:Record<SourceTrust,number>={unavailable:0,degraded:1,trusted:2};
export function arbitrateMeasurementSource(measurements:SourceMeasurement[],nowMs:number,policy:SourceArbitrationPolicy):SourceArbitration{
  if(!Number.isFinite(nowMs)||!Number.isFinite(policy.maxAgeMs)||!Number.isFinite(policy.minConfidence)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1)return{source:null,value:null,status:'unavailable',reason:'invalid-policy'};
  const order=new Map(policy.preferredOrder.map((source,index)=>[source,index]));
  const candidates=measurements.filter((item)=>item.value!==null&&Number.isFinite(item.value)&&Number.isFinite(item.observedAtMs)&&Number.isFinite(item.confidence)&&item.observedAtMs<=nowMs&&nowMs-item.observedAtMs<=policy.maxAgeMs&&item.trust!=='unavailable');
  if(candidates.length===0)return{source:null,value:null,status:'unavailable',reason:'no-fresh-source'};
  candidates.sort((a,b)=>trustRank[b.trust]-trustRank[a.trust]||b.confidence-a.confidence||(order.get(a.source)??999)-(order.get(b.source)??999)||b.observedAtMs-a.observedAtMs);
  const selected=candidates[0]!;
  if(selected.trust!=='trusted'||selected.confidence<policy.minConfidence)return{source:selected.source,value:selected.value,status:'degraded',reason:selected.trust!=='trusted'?'selected-source-degraded':'confidence-below-policy'};
  return{source:selected.source,value:selected.value,status:'selected',reason:'highest-trust-fresh-source'};
}
