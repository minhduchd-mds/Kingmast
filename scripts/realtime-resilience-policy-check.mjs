import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function fail(message){failures.push(message);}
function read(path){const full=resolve(root,path);if(!existsSync(full)){fail(`${path}: missing`);return'';}return readFileSync(full,'utf8');}

const contractsPackage=read('packages/contracts/package.json');
const accumulator=read('packages/contracts/src/realtime-health.ts');
const client=read('apps/hmi/lib/realtime.ts');
const recoveryCli=read('services/risk-engine/src/realtime-recovery-evidence-cli.ts');
const integrationCli=read('services/risk-engine/src/realtime-integration-evidence-cli.ts');
const doc=read('docs/validation/REALTIME_HMI_RECOVERY_V006.md');
const latencyPlan=read('docs/validation/E2E_TELEMETRY_LATENCY_PLAN_V006.md');
const ci=read('.github/workflows/ci.yml');

if(!contractsPackage.includes('"./realtime-health":"./src/realtime-health.ts"'))fail('shared realtime-health contract export is missing');
if(!accumulator.includes('class RealtimeLinkAccumulator')||!accumulator.includes('sequenceRegressions')||!accumulator.includes('sessionChanges')||!accumulator.includes('serverToClient')||!accumulator.includes('ingressToClient'))fail('shared bounded realtime accumulator contract is incomplete');
if(!accumulator.includes('le20')||!accumulator.includes('le50')||!accumulator.includes('le100')||!accumulator.includes('le250')||!accumulator.includes('le500')||!accumulator.includes('gt500'))fail('realtime latency must use fixed-cardinality buckets');
if(/\b(history|samplesHistory|latencies)\s*[:=]\s*\[/i.test(accumulator))fail('realtime accumulator must not retain an unbounded latency history');
if(!client.includes("from '@kingmast/contracts/realtime-health'")||!client.includes('new RealtimeLinkAccumulator()')||!client.includes("'kingmast:realtime-health'")||!client.includes('observeTelemetry('))fail('HMI realtime client must consume the shared bounded accumulator and publish health snapshots');
if(!client.includes('deviceId')||!client.includes('bootId')||!client.includes('lastIngressAtMs'))fail('HMI realtime observation must preserve boot-session identity and ingress timing context');
if(!recoveryCli.includes("schema:'kingmast-realtime-recovery-report/v1'")||!recoveryCli.includes("controlAuthority:'none'")||!recoveryCli.includes("qualificationClaim:'deterministic-software-recovery-only-not-physical-hil'")||!recoveryCli.includes('physicalControllerTest:false')||!recoveryCli.includes('targetHardwareQualified:false')||!recoveryCli.includes('browserNetworkMeasured:false'))fail('deterministic recovery evidence must preserve explicit non-HIL/non-hardware claim boundaries');
if(!integrationCli.includes("schema:'kingmast-realtime-loopback-integration-report/v1'")||!integrationCli.includes("qualificationClaim:'ci-loopback-process-integration-only-not-target-hardware'")||!integrationCli.includes('physicalControllerTest:false')||!integrationCli.includes('targetHardwareQualified:false')||!integrationCli.includes('browserRenderMeasured:false')||!integrationCli.includes('/v3/edge/frame')||!integrationCli.includes('/v3/stream'))fail('loopback integration evidence must exercise real ingress/stream paths while preserving non-hardware claims');
if(!/not a physical HIL result/i.test(doc)||!/do(?:es)? not qualify target hardware/i.test(doc))fail('realtime recovery documentation must explicitly reject physical HIL and target-hardware claims');
if(!/synchronized clocks/i.test(latencyPlan)||!/p50.*p95.*p99.*max/i.test(latencyPlan)||!/CI.*must not.*vehicle timing/i.test(latencyPlan))fail('telemetry latency plan must define clock discipline, percentiles and CI-to-vehicle claim separation');
if(!ci.includes('Realtime reconnect and HMI transport evidence')||!ci.includes('/tmp/kingmast.realtime-recovery.json')||!ci.includes('Realtime edge-to-stream loopback integration evidence')||!ci.includes('/tmp/kingmast.realtime-loopback.json')||!ci.includes('pnpm realtime:policy'))fail('CI realtime recovery/integration/policy gates are missing');
if(!ci.includes('KINGMAST_EVIDENCE_PATHS')||!ci.includes('/tmp/kingmast.realtime-recovery.json')||!ci.includes('/tmp/kingmast.realtime-loopback.json'))fail('realtime reports must be bound into engineering evidence');

if(failures.length){console.error('KINGMAST realtime resilience policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST realtime resilience policy passed: bounded HMI transport metrics, real loopback recovery evidence and non-HIL claim boundaries remain enforced.');
