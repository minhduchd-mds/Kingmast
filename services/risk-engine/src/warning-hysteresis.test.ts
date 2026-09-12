import{describe,expect,it}from'vitest';
import{applyWarningHysteresis}from'./warning-hysteresis.js';
const p={releaseSamples:3,maxAgeMs:1000};
const s=(observedAtMs:number,recommended:'safe'|'watch'|'warning'|'critical')=>({observedAtMs,recommended});
describe('warning hysteresis',()=>{
 it('escalates critical immediately',()=>expect(applyWarningHysteresis('watch',[s(1000,'critical')],1100,p)).toEqual({level:'critical',reason:'critical-escalation-immediate'}));
 it('does not delay normal hazard escalation',()=>expect(applyWarningHysteresis('safe',[s(1000,'warning')],1100,p).level).toBe('warning'));
 it('holds recovery until enough lower samples',()=>expect(applyWarningHysteresis('warning',[s(900,'safe'),s(1000,'safe')],1100,p)).toEqual({level:'warning',reason:'release-hysteresis-hold'}));
 it('releases after stable lower evidence',()=>expect(applyWarningHysteresis('warning',[s(800,'safe'),s(900,'safe'),s(1000,'safe')],1100,p).level).toBe('safe'));
});
