export type RuntimeHealthState='nominal'|'degraded'|'fault';

export interface RuntimeSensorHealth {required:boolean;ageMs:number|null;maxAgeMs:number;}
export interface RuntimeHealthObservation {nowMs:number;heartbeatAtMs:number;restartCount:number;eventLoopP99Ms:number;freeMemoryMiB:number;thermalMaxC:number|null;canTxAttemptCount:number;sensors:Record<string,RuntimeSensorHealth>;}
export interface RuntimeHealthRequirements {watchdogTimeoutMs:number;maxRestartCount:number;maxEventLoopP99Ms:number;minFreeMemoryMiB:number;maxTemperatureC:number;}
export interface RuntimeHealthReason {code:string;severity:'degraded'|'fault';detail:string;}
export interface RuntimeHealthAssessment {
  schema:'kingmast-runtime-health-assessment/v1';controlAuthority:'none';automaticActuation:false;canWriteAuthority:false;state:RuntimeHealthState;serviceAction:'none'|'inspect'|'restart-or-service';reasons:RuntimeHealthReason[];
  checks:{watchdogPassed:boolean;restartBudgetPassed:boolean;eventLoopPassed:boolean;memoryPassed:boolean;thermalPassed:boolean;sensorFreshnessPassed:boolean;canAuthorityPassed:boolean;};
}

function finiteNonNegative(value:number){return Number.isFinite(value)&&value>=0;}

export function assessRuntimeHealth(observation:RuntimeHealthObservation,requirements:RuntimeHealthRequirements):RuntimeHealthAssessment{
  if(!finiteNonNegative(observation.nowMs)||!finiteNonNegative(observation.heartbeatAtMs))throw new Error('runtime timestamps must be finite non-negative values');
  if(!finiteNonNegative(requirements.watchdogTimeoutMs)||requirements.watchdogTimeoutMs===0)throw new Error('watchdogTimeoutMs must be positive');
  const reasons:RuntimeHealthReason[]=[];
  const heartbeatAgeMs=Math.max(0,observation.nowMs-observation.heartbeatAtMs);
  const watchdogPassed=heartbeatAgeMs<=requirements.watchdogTimeoutMs;
  if(!watchdogPassed)reasons.push({code:'watchdog-timeout',severity:'fault',detail:`heartbeat age ${heartbeatAgeMs} ms exceeds ${requirements.watchdogTimeoutMs} ms`});
  const restartBudgetPassed=observation.restartCount<=requirements.maxRestartCount;
  if(!restartBudgetPassed)reasons.push({code:'restart-budget-exceeded',severity:'fault',detail:`restart count ${observation.restartCount} exceeds ${requirements.maxRestartCount}`});
  const eventLoopPassed=observation.eventLoopP99Ms<=requirements.maxEventLoopP99Ms;
  if(!eventLoopPassed)reasons.push({code:'event-loop-latency',severity:'degraded',detail:`event-loop p99 ${observation.eventLoopP99Ms} ms exceeds ${requirements.maxEventLoopP99Ms} ms`});
  const memoryPassed=observation.freeMemoryMiB>=requirements.minFreeMemoryMiB;
  if(!memoryPassed)reasons.push({code:'low-free-memory',severity:'degraded',detail:`free memory ${observation.freeMemoryMiB} MiB below ${requirements.minFreeMemoryMiB} MiB`});
  const thermalPassed=observation.thermalMaxC===null||observation.thermalMaxC<=requirements.maxTemperatureC;
  if(!thermalPassed)reasons.push({code:'thermal-budget',severity:'degraded',detail:`temperature ${observation.thermalMaxC} C exceeds ${requirements.maxTemperatureC} C`});
  let sensorFreshnessPassed=true;
  for(const [name,sensor] of Object.entries(observation.sensors)){
    const fresh=sensor.ageMs!==null&&sensor.ageMs>=0&&sensor.ageMs<=sensor.maxAgeMs;
    if(sensor.required&&!fresh){sensorFreshnessPassed=false;reasons.push({code:`sensor-stale:${name}`,severity:'degraded',detail:`required sensor ${name} is unavailable or stale`});}
  }
  const canAuthorityPassed=observation.canTxAttemptCount===0;
  if(!canAuthorityPassed)reasons.push({code:'can-tx-authority-violation',severity:'fault',detail:`observed ${observation.canTxAttemptCount} attempted CAN transmit operation(s) in a read-only product boundary`});
  const state:RuntimeHealthState=reasons.some((item)=>item.severity==='fault')?'fault':(reasons.length?'degraded':'nominal');
  return{schema:'kingmast-runtime-health-assessment/v1',controlAuthority:'none',automaticActuation:false,canWriteAuthority:false,state,serviceAction:state==='fault'?'restart-or-service':state==='degraded'?'inspect':'none',reasons,checks:{watchdogPassed,restartBudgetPassed,eventLoopPassed,memoryPassed,thermalPassed,sensorFreshnessPassed,canAuthorityPassed}};
}
