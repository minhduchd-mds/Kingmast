import type { RiskAssessment,VehicleSample } from '@kingmast/contracts';
import { assessRisk } from './risk.js';

const SCHEMA='kingmast-risk-performance-report/v1' as const;
const CONTROL_AUTHORITY='none' as const;
const QUALIFICATION_CLAIM='ci-regression-only-not-target-hardware' as const;
const NOW_MS=1_800_000_000_000;
const DEFAULT_ITERATIONS=20_000;
const DEFAULT_WARMUP=2_000;
const DEFAULT_P99_BUDGET_MS=5;

interface Scenario {
  name:string;
  sample:VehicleSample;
  expectedSeverity:RiskAssessment['severity'];
  expectedReason?:string;
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

function percentile(sorted:number[],fraction:number){
  if(sorted.length===0)return 0;
  const index=Math.max(0,Math.min(sorted.length-1,Math.ceil(sorted.length*fraction)-1));
  return sorted[index]??0;
}

function round(value:number){return Number(value.toFixed(4));}

function classificationFailure(scenario:Scenario,result:RiskAssessment){
  if(result.severity!==scenario.expectedSeverity)return `${scenario.name}: expected severity ${scenario.expectedSeverity}, got ${result.severity}`;
  if(scenario.expectedReason&&!result.reasons.includes(scenario.expectedReason))return `${scenario.name}: missing reason ${scenario.expectedReason}`;
  return null;
}

const iterations=boundedInteger('KINGMAST_RISK_PERF_ITERATIONS',DEFAULT_ITERATIONS,1_000,100_000);
const warmupIterations=boundedInteger('KINGMAST_RISK_PERF_WARMUP',DEFAULT_WARMUP,100,20_000);
const p99BudgetMs=boundedNumber('KINGMAST_RISK_P99_BUDGET_MS',DEFAULT_P99_BUDGET_MS,0.5,100);

const classificationFailures:string[]=[];
for(const scenario of scenarios){
  const failure=classificationFailure(scenario,assessRisk(scenario.sample,NOW_MS));
  if(failure)classificationFailures.push(failure);
}

for(let index=0;index<warmupIterations;index+=1){
  const scenario=scenarios[index%scenarios.length]!;
  assessRisk(scenario.sample,NOW_MS);
}

const durationsMs:number[]=[];
for(let index=0;index<iterations;index+=1){
  const scenario=scenarios[index%scenarios.length]!;
  const started=process.hrtime.bigint();
  const result=assessRisk(scenario.sample,NOW_MS);
  const elapsedMs=Number(process.hrtime.bigint()-started)/1_000_000;
  durationsMs.push(elapsedMs);
  const failure=classificationFailure(scenario,result);
  if(failure&&classificationFailures.length<32)classificationFailures.push(`${failure} @ iteration ${index}`);
}

durationsMs.sort((left,right)=>left-right);
const latencyMs={
  p50:round(percentile(durationsMs,0.50)),
  p95:round(percentile(durationsMs,0.95)),
  p99:round(percentile(durationsMs,0.99)),
  max:round(durationsMs.at(-1)??0),
};
const timingPassed=latencyMs.p99<=p99BudgetMs;
const allPassed=classificationFailures.length===0&&timingPassed;

const report={
  schema:SCHEMA,
  generatedAt:new Date().toISOString(),
  controlAuthority:CONTROL_AUTHORITY,
  qualificationClaim:QUALIFICATION_CLAIM,
  targetHardwareQualified:false,
  benchmarkScope:'deterministic-risk-core-process-local',
  timingNote:'Shared CI wall-clock timing is a regression signal only; it is not automotive real-time or target-hardware qualification.',
  runtime:{node:process.version,platform:process.platform,arch:process.arch,ci:process.env.CI==='true'},
  workload:{scenarioCount:scenarios.length,warmupIterations,iterations},
  budget:{p99Ms:p99BudgetMs},
  latencyMs,
  classification:{passed:classificationFailures.length===0,failures:classificationFailures},
  timing:{passed:timingPassed},
  allPassed,
};

const serialized=JSON.stringify(report,null,2);
console.log(serialized);
if(!allPassed){
  // CI redirects stdout to the evidence artifact. Mirror a bounded diagnostic summary to stderr
  // so a failed regression gate is debuggable without weakening or bypassing the timing budget.
  console.error('[risk-performance] regression gate failed');
  console.error(`[risk-performance] p50=${latencyMs.p50}ms p95=${latencyMs.p95}ms p99=${latencyMs.p99}ms max=${latencyMs.max}ms budget.p99=${p99BudgetMs}ms`);
  if(classificationFailures.length)console.error(`[risk-performance] classification failures: ${classificationFailures.slice(0,8).join(' | ')}`);
  process.exitCode=1;
}
