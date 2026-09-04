import type { LocationAlert, Severity } from '@kingmast/contracts';

const HOLD_MS=1_200;
const DOWNGRADE_HOLD_MS=1_800;
const rank:Record<Severity,number>={safe:1,caution:2,critical:3};

interface ActiveAlert {
  alert:LocationAlert;
  lastSeenAtMs:number;
  severityChangedAtMs:number;
}

function stableKey(alert:LocationAlert) {
  const subject=alert.objectId??alert.title.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  return `${alert.type}:${subject}`;
}

export class AlertStabilizer {
  private readonly active=new Map<string,ActiveAlert>();

  update(incoming:LocationAlert[],nowMs=Date.now()):LocationAlert[] {
    const seen=new Set<string>();
    for(const next of incoming){
      const key=stableKey(next);
      seen.add(key);
      const previous=this.active.get(key);
      let severity=next.severity;
      let severityChangedAtMs=previous?.severityChangedAtMs??nowMs;
      if(previous){
        if(rank[next.severity]<rank[previous.alert.severity] && nowMs-previous.severityChangedAtMs<DOWNGRADE_HOLD_MS) severity=previous.alert.severity;
        else if(next.severity!==previous.alert.severity) severityChangedAtMs=nowMs;
      }
      this.active.set(key,{
        alert:{...next,id:key,severity},
        lastSeenAtMs:nowMs,
        severityChangedAtMs,
      });
    }

    for(const [key,value] of this.active){
      if(!seen.has(key) && nowMs-value.lastSeenAtMs>HOLD_MS) this.active.delete(key);
    }

    return [...this.active.values()]
      .map((entry)=>entry.alert)
      .sort((a,b)=>rank[b.severity]-rank[a.severity]||b.timestampMs-a.timestampMs);
  }
}
