import {describe,expect,it} from 'vitest';
import {assessRuntimeHealth,type RuntimeHealthObservation,type RuntimeHealthRequirements} from './runtime-health-supervisor.js';

const requirements:RuntimeHealthRequirements={watchdogTimeoutMs:1500,maxRestartCount:2,maxEventLoopP99Ms:120,minFreeMemoryMiB:256,maxTemperatureC:95};
const nominal:RuntimeHealthObservation={nowMs:10_000,heartbeatAtMs:9_700,restartCount:0,eventLoopP99Ms:18,freeMemoryMiB:1024,thermalMaxC:66,canTxAttemptCount:0,sensors:{radarFront:{required:true,ageMs:80,maxAgeMs:500},camera:{required:true,ageMs:120,maxAgeMs:500},gnss:{required:false,ageMs:null,maxAgeMs:1000}}};

describe('runtime health supervisor',()=>{
  it('keeps nominal runtime advisory-only',()=>{const result=assessRuntimeHealth(nominal,requirements);expect(result.state).toBe('nominal');expect(result.controlAuthority).toBe('none');expect(result.automaticActuation).toBe(false);expect(result.canWriteAuthority).toBe(false);expect(result.reasons).toHaveLength(0);});
  it('degrades on stale required sensing without inventing control authority',()=>{const result=assessRuntimeHealth({...nominal,sensors:{...nominal.sensors,radarFront:{required:true,ageMs:900,maxAgeMs:500}}},requirements);expect(result.state).toBe('degraded');expect(result.checks.sensorFreshnessPassed).toBe(false);expect(result.reasons.some((item)=>item.code==='sensor-stale:radarFront')).toBe(true);expect(result.canWriteAuthority).toBe(false);});
  it('degrades on resource pressure',()=>{const result=assessRuntimeHealth({...nominal,eventLoopP99Ms:180,freeMemoryMiB:128,thermalMaxC:101},requirements);expect(result.state).toBe('degraded');expect(result.checks.eventLoopPassed).toBe(false);expect(result.checks.memoryPassed).toBe(false);expect(result.checks.thermalPassed).toBe(false);});
  it('faults on watchdog timeout',()=>{const result=assessRuntimeHealth({...nominal,heartbeatAtMs:8_000},requirements);expect(result.state).toBe('fault');expect(result.serviceAction).toBe('restart-or-service');expect(result.checks.watchdogPassed).toBe(false);});
  it('faults closed on any attempted CAN transmit operation',()=>{const result=assessRuntimeHealth({...nominal,canTxAttemptCount:1},requirements);expect(result.state).toBe('fault');expect(result.checks.canAuthorityPassed).toBe(false);expect(result.reasons.some((item)=>item.code==='can-tx-authority-violation')).toBe(true);});
});
