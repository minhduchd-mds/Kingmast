import{describe,expect,it}from'vitest';
import{shouldPresentAlert}from'./alert-cooldown-policy.js';
const p={cooldownMs:5000};
const a=(severity:'info'|'watch'|'warning'|'critical',occurredAtMs:number,id='fcw')=>({id,severity,occurredAtMs});
describe('alert cooldown policy',()=>{
 it('shows new alert',()=>expect(shouldPresentAlert(a('warning',1000),null,1100,p).show).toBe(true));
 it('suppresses repeated alert inside cooldown',()=>expect(shouldPresentAlert(a('warning',3000),a('warning',1000),3100,p).reason).toBe('repeat-within-cooldown'));
 it('never suppresses severity escalation',()=>expect(shouldPresentAlert(a('critical',3000),a('warning',1000),3100,p).reason).toBe('severity-escalation'));
 it('shows same severity after cooldown',()=>expect(shouldPresentAlert(a('warning',7000),a('warning',1000),7100,p).show).toBe(true));
});
