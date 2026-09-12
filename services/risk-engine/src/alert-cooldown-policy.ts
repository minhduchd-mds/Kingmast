export type AlertSeverity='info'|'watch'|'warning'|'critical';
export type AlertEvent={id:string;severity:AlertSeverity;occurredAtMs:number};
export type AlertCooldownPolicy={cooldownMs:number};
export type AlertDecision={show:boolean;reason:string};

const rank:Record<AlertSeverity,number>={info:0,watch:1,warning:2,critical:3};
export function shouldPresentAlert(current:AlertEvent,previous:AlertEvent|null,nowMs:number,policy:AlertCooldownPolicy):AlertDecision{
 if(!Number.isFinite(nowMs)||!Number.isFinite(current.occurredAtMs)||policy.cooldownMs<0||current.id.length===0||current.occurredAtMs>nowMs)return{show:false,reason:'invalid-or-future-alert'};
 if(!previous||previous.id!==current.id)return{show:true,reason:'new-alert'};
 if(!Number.isFinite(previous.occurredAtMs)||previous.occurredAtMs>current.occurredAtMs)return{show:false,reason:'non-monotonic-alert-history'};
 if(rank[current.severity]>rank[previous.severity])return{show:true,reason:'severity-escalation'};
 if(current.occurredAtMs-previous.occurredAtMs>=policy.cooldownMs)return{show:true,reason:'cooldown-expired'};
 return{show:false,reason:'repeat-within-cooldown'};
}
