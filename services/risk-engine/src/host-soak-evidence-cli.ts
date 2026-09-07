import type { RiskAssessment,VehicleSample } from '@kingmast/contracts';
import { monitorEventLoopDelay,performance } from 'node:perf_hooks';
import { assessRisk } from './risk.js';

const SCHEMA='kingmast-host-soak-report/v1' as const;
const CONTROL_AUTHORITY='none' as const;
const QUALIFICATION_CLAIM='ci-host-soak-regression-only-not-target-hardware' as const;
const NOW_MS=1_800_000_000_000;
const DEFAULT_DURATION_SECONDS=30;
const DEFAULT_BATCH_SIZE=500;
const DEFAULT_MEMORY_GROWTH_BUDGET_MIB=96;
const DEFAULT_EVENT_LOOP_P99_BUDGET_MS=250;
const SAMPLE_INTERVAL_MS=250;
const MIB=1024*1024;

interface Scenario {
  name:string;
  sample:VehicleSample;
  expectedSeverity:RiskAssessment['severity'];
  expectedReason?:string;
}

interface MemorySample {
  atMs:number;
  rss:number;
  heapUsed:number;
  external:number;
}

function sample(overrides:Partial<VehicleSample>):VehicleSample{
  return{
    timestampMs:NOW_MS,
    egoSpeedMps:20,
    targetSpeedMps:20,
    rangeM:40,
    confidence:0.95,
    canHealthy:true,
    radarHealthy:true,
    cameraHealthy:true,
    ...overrides,
  };
}

const scenarios:Scenario[]=[
  {name:'safe-following',sample:sample({}),expectedSeverity:'safe'},
  {name:'short-headway-caution',sample:sample({targetSpeedMps:15,rangeM:25}),expectedSeverity:'caution',expectedReason:'closing-gap'},
  {name:'closing-gap-critical',sample:sample({targetSpeedMps:0,rangeM:10}),expectedSeverity:'critical',expectedReason:'closing-gap'},
  {name:'stale-rejected',sample:sample({timestampMs:NOW_MS-1_000}),expectedSeverity:'safe',expectedReason:'stale-data-rejected'},
  {name:'future-rejected',sample:sample({timestampMs:NOW_MS+100}),expectedSeverity:'safe',expectedReason:'future-data-rejected'},
  {name:'radar-unavailable',sample:sample({radarHealthy:false}),expectedSeverity:'safe',expectedReason:'radar-unavailable'},
  {name:'can-degraded',sample:sample({targetSpeedMps:15,rangeM:25,confidence:0.8,canHealthy:false}),expectedSeverity:'caution',expectedReason:'can-degraded'},
];

function boundedInteger(name:string,fallback:number,min:number,max:number){
  const parsed=Number(process.env[name]??fallback);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.floor(parsed))):fallback;
}

function boundedNumber(name:string,fallback:number,min:number,max:number){
  const parsed=Number(process.env[name]??fallback);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;
}

function round(value:number,digits=3){return Number(value.toFixed(digits));}
function bytesToMiB(value:number){return round(value/MIB);}
function nanosToMs(value:number){return round(value/1_000_000);}
function delayImmediate(){return new Promise<void>((resolve)=>setImmediate(resolve));}

function classificationFailure(scenario:Scenario,result:RiskAssessment){
  if(result.severity!==scenario.expectedSeverity)return `${scenario.name}: expected severity ${scenario.expectedSeverity}, got ${result.severity}`;
  if(scenario.expectedReason&&!result.reasons.includes(scenario.expectedReason))return `${scenario.name}: missing reason ${scenario.expectedReason}`;
  return null;
}

function captureMemory(atMs:number):MemorySample{
  const memory=process.memoryUsage();
  return{atMs,rss:memory.rss,heapUsed:memory.heapUsed,external:memory.external};
}

const durationSeconds=boundedInteger('KINGMAST_HOST_SOAK_SECONDS',DEFAULT_DURATION_SECONDS,2,3_600);
const batchSize=boundedInteger('KINGMAST_HOST_SOAK_BATCH',DEFAULT_BATCH_SIZE,10,10_000);
const memoryGrowthBudgetMiB=boundedNumber('KINGMAST_HOST_SOAK_MEMORY_GROWTH_MIB',DEFAULT_MEMORY_GROWTH_BUDGET_MIB,16,1_024);
const eventLoopP99BudgetMs=boundedNumber('KINGMAST_HOST_SOAK_EVENT_LOOP_P99_MS',DEFAULT_EVENT_LOOP_P99_BUDGET_MS,25,2_000);

const failures:string[]=[];
const memorySamples:MemorySample[]=[];
const eventLoopDelay=monitorEventLoopDelay({resolution:20});
const startedAt=performance.now();
const cpuStarted=process.cpuUsage();
let lastSampleAt=startedAt;
let operations=0;
let batchIndex=0;
memorySamples.push(captureMemory(0));
eventLoopDelay.enable();

while(performance.now()-startedAt<durationSeconds*1_000){
  for(let index=0;index<batchSize;index+=1){
    const scenario=scenarios[(operations+index)%scenarios.length]!;
    const result=assessRisk(scenario.sample,NOW_MS);
    const failure=classificationFailure(scenario,result);
    if(failure&&failures.length<32)failures.push(`${failure} @ operation ${operations+index}`);
  }
  operations+=batchSize;
  batchIndex+=1;
  const now=performance.now();
  if(now-lastSampleAt>=SAMPLE_INTERVAL_MS){
    memorySamples.push(captureMemory(now-startedAt));
    lastSampleAt=now;
  }
  await delayImmediate();
}

eventLoopDelay.disable();
const finishedAt=performance.now();
const elapsedMs=finishedAt-startedAt;
const cpu=process.cpuUsage(cpuStarted);
memorySamples.push(captureMemory(elapsedMs));

const rssStart=memorySamples[0]?.rss??0;
const rssEnd=memorySamples.at(-1)?.rss??rssStart;
const rssPeak=Math.max(...memorySamples.map((item)=>item.rss));
const heapStart=memorySamples[0]?.heapUsed??0;
const heapEnd=memorySamples.at(-1)?.heapUsed??heapStart;
const heapPeak=Math.max(...memorySamples.map((item)=>item.heapUsed));
const rssGrowthMiB=bytesToMiB(Math.max(0,rssPeak-rssStart));
const heapGrowthMiB=bytesToMiB(Math.max(0,heapPeak-heapStart));
const memoryPassed=rssGrowthMiB<=memoryGrowthBudgetMiB;
const eventLoopP99Ms=nanosToMs(eventLoopDelay.percentile(99));
const eventLoopMaxMs=nanosToMs(eventLoopDelay.max);
const eventLoopPassed=eventLoopP99Ms<=eventLoopP99BudgetMs;
const classificationPassed=failures.length===0;
const allPassed=classificationPassed&&memoryPassed&&eventLoopPassed&&operations>=batchSize;
const cpuTotalMs=(cpu.user+cpu.system)/1_000;

const report={
  schema:SCHEMA,
  generatedAt:new Date().toISOString(),
  controlAuthority:CONTROL_AUTHORITY,
  qualificationClaim:QUALIFICATION_CLAIM,
  targetHardwareQualified:false,
  physicalVehicleComputerTest:false,
  benchmarkScope:'process-local-risk-core-host-soak',
  runtime:{node:process.version,platform:process.platform,arch:process.arch,ci:process.env.CI==='true'},
  workload:{durationSeconds:round(elapsedMs/1_000),scenarioCount:scenarios.length,batchSize,batches:batchIndex,operations,operationsPerSecond:round(operations/(elapsedMs/1_000))},
  classification:{passed:classificationPassed,failures},
  memory:{
    samples:memorySamples.length,
    rssStartMiB:bytesToMiB(rssStart),
    rssPeakMiB:bytesToMiB(rssPeak),
    rssEndMiB:bytesToMiB(rssEnd),
    rssGrowthMiB,
    heapUsedStartMiB:bytesToMiB(heapStart),
    heapUsedPeakMiB:bytesToMiB(heapPeak),
    heapUsedEndMiB:bytesToMiB(heapEnd),
    heapGrowthMiB,
    budgetGrowthMiB:memoryGrowthBudgetMiB,
    passed:memoryPassed,
  },
  eventLoop:{p99Ms:eventLoopP99Ms,maxMs:eventLoopMaxMs,budgetP99Ms:eventLoopP99BudgetMs,passed:eventLoopPassed},
  cpu:{userMs:round(cpu.user/1_000),systemMs:round(cpu.system/1_000),totalMs:round(cpuTotalMs),cpuToWallRatio:round(cpuTotalMs/elapsedMs)},
  allPassed,
  limitations:[
    'Shared CI host timing, memory and CPU measurements are regression signals only.',
    'This report does not qualify a target vehicle computer, thermal envelope, power budget or automotive real-time deadline.',
    'Physical controller soak, reboot/reconnect, sensor I/O, thermal throttling and power-cycle evidence remain HIL/target-hardware work.',
  ],
};

console.log(JSON.stringify(report,null,2));
if(!allPassed)process.exitCode=1;
