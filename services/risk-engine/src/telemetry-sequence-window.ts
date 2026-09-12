export type TelemetryPacket={sequence:number;observedAtMs:number};
export type SequencePolicy={windowSize:number;maxFutureMs:number};
export type SequenceAssessment={status:'accepted'|'duplicate'|'replay'|'invalid';reason:string};

export function assessTelemetrySequence(packet:TelemetryPacket,recent:TelemetryPacket[],nowMs:number,policy:SequencePolicy):SequenceAssessment{
 if(!Number.isInteger(packet.sequence)||packet.sequence<0||!Number.isFinite(packet.observedAtMs)||!Number.isFinite(nowMs)||!Number.isInteger(policy.windowSize)||policy.windowSize<1||policy.maxFutureMs<0)return{status:'invalid',reason:'invalid-sequence-evidence'};
 if(packet.observedAtMs>nowMs+policy.maxFutureMs)return{status:'invalid',reason:'future-timestamp'};
 const ordered=recent.filter((item)=>Number.isInteger(item.sequence)&&item.sequence>=0&&Number.isFinite(item.observedAtMs)).sort((a,b)=>b.sequence-a.sequence).slice(0,policy.windowSize);
 if(ordered.some((item)=>item.sequence===packet.sequence))return{status:'duplicate',reason:'sequence-already-seen'};
 const highest=ordered[0]?.sequence;
 if(highest!==undefined&&packet.sequence<highest)return{status:'replay',reason:'sequence-regression'};
 const latestTime=Math.max(...ordered.map((item)=>item.observedAtMs),Number.NEGATIVE_INFINITY);
 if(Number.isFinite(latestTime)&&packet.observedAtMs<latestTime)return{status:'replay',reason:'timestamp-regression'};
 return{status:'accepted',reason:'monotonic-new-sequence'};
}
