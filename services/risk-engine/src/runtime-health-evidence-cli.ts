import {assessRuntimeHealth,type RuntimeHealthObservation,type RuntimeHealthRequirements} from './runtime-health-supervisor.js';

const requirements:RuntimeHealthRequirements={watchdogTimeoutMs:1500,maxRestartCount:2,maxEventLoopP99Ms:120,minFreeMemoryMiB:256,maxTemperatureC:95};
const base:RuntimeHealthObservation={nowMs:20_000,heartbeatAtMs:19_800,restartCount:0,eventLoopP99Ms:20,freeMemoryMiB:1024,thermalMaxC:64,canTxAttemptCount:0,sensors:{radarFront:{required:true,ageMs:90,maxAgeMs:500},camera:{required:true,ageMs:110,maxAgeMs:500}}};
const cases=[
{id:'RUNTIME-NOMINAL',expected:'nominal',observation:base},
{id:'RUNTIME-STALE-SENSOR',expected:'degraded',observation:{...base,sensors:{...base.sensors,radarFront:{required:true,ageMs:900,maxAgeMs:500}}}},
{id:'RUNTIME-RESOURCE-PRESSURE',expected:'degraded',observation:{...base,eventLoopP99Ms:180,freeMemoryMiB:128,thermalMaxC:102}},
{id:'RUNTIME-WATCHDOG',expected:'fault',observation:{...base,heartbeatAtMs:17_000}},
{id:'RUNTIME-CAN-AUTHORITY',expected:'fault',observation:{...base,canTxAttemptCount:1}}
].map((testCase)=>{const actual=assessRuntimeHealth(testCase.observation,requirements);return{id:testCase.id,expected:testCase.expected,actual:actual.state,passed:actual.state===testCase.expected,assessment:actual};});
const failed=cases.filter((item)=>!item.passed);
const report={schema:'kingmast-runtime-health-evidence/v1',productVersion:'0.0.6',controlAuthority:'none',qualificationClaim:'deterministic-runtime-supervisor-software-evidence-only-not-target-hardware',automaticActuation:false,canWriteAuthority:false,targetHardwareQualified:false,physicalVehicleComputerTest:false,total:cases.length,passed:cases.length-failed.length,failed:failed.length,allPassed:failed.length===0,cases};
console.log(JSON.stringify(report,null,2));
if(!report.allPassed)process.exit(1);
