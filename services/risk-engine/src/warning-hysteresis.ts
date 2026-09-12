export type WarningLevel='safe'|'watch'|'warning'|'critical';
export type WarningSample={observedAtMs:number;recommended:WarningLevel};
export type WarningHysteresisPolicy={releaseSamples:number;maxAgeMs:number};
export type WarningHysteresisResult={level:WarningLevel;reason:string};
const rank:Record<WarningLevel,number>={safe:0,watch:1,warning:2,critical:3};

export function applyWarningHysteresis(previous:WarningLevel,samples:WarningSample[],nowMs:number,policy:WarningHysteresisPolicy):WarningHysteresisResult{
 if(!Number.isFinite(nowMs)||!Number.isInteger(policy.releaseSamples)||policy.releaseSamples<1||policy.maxAgeMs<0)return{level:previous,reason:'invalid-policy-hold'};
 const fresh=samples.filter((sample)=>Number.isFinite(sample.observedAtMs)&&sample.observedAtMs<=nowMs&&nowMs-sample.observedAtMs<=policy.maxAgeMs).sort((a,b)=>a.observedAtMs-b.observedAtMs);
 if(fresh.length===0)return{level:previous,reason:'no-fresh-evidence-hold'};
 const latest=fresh.at(-1)!.recommended;
 if(rank[latest]>rank[previous])return{level:latest,reason:latest==='critical'?'critical-escalation-immediate':'hazard-escalation-immediate'};
 if(rank[latest]===rank[previous])return{level:previous,reason:'level-stable'};
 let releaseStreak=0;
 for(let index=fresh.length-1;index>=0;index--){if(rank[fresh[index]!.recommended]<rank[previous])releaseStreak++;else break;}
 if(releaseStreak<policy.releaseSamples)return{level:previous,reason:'release-hysteresis-hold'};
 return{level:latest,reason:'release-evidence-satisfied'};
}
