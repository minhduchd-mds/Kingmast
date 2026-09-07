import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const required=[
  'docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md',
  'docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md',
  'docs/safety/ODD_V006.md',
  'docs/safety/HARA_DRAFT_V006.md',
  'docs/safety/SOTIF_SCENARIO_CATALOG_V006.md',
  'docs/cybersecurity/TARA_V006.md',
  'docs/updates/SUMS_OTA_ARCHITECTURE_V006.md',
  'docs/validation/SIL_HIL_FAULT_INJECTION_PLAN_V006.md',
  'docs/architecture/READ_ONLY_VEHICLE_PORT.md',
  'packages/contracts/src/vehicle-readonly.ts',
  'services/risk-engine/src/update-verifier.ts',
  'services/risk-engine/src/update-verifier.test.ts',
  '.github/CODEOWNERS',
];
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
for(const path of required)read(path);
const plan=read('docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md');
const odd=read('docs/safety/ODD_V006.md');
const research=read('docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md');
const vehiclePort=read('packages/contracts/src/vehicle-readonly.ts');
const contractsPackage=read('packages/contracts/package.json');
const edgeGuard=read('services/risk-engine/src/edge-guard.ts');
const clientError=read('apps/hmi/app/api/kingmast/client-error/route.ts');
const updateVerifier=read('services/risk-engine/src/update-verifier.ts');
const codeowners=read('.github/CODEOWNERS');
if(!/warning-only/i.test(plan)||!/no steering|no code path.*actuator|vehicle actuation is prohibited/i.test(plan))failures.push('program plan must preserve explicit Level-0/no-actuation boundary');
if(!/Public-road deployment is outside this ODD/i.test(odd))failures.push('ODD must keep public-road deployment outside v0.0.6 research boundary');
if(!/public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation/i.test(research))failures.push('clean-room research transformation rule missing');
if(!vehiclePort.includes("VEHICLE_PORT_AUTHORITY='read-only'")||!vehiclePort.includes('interface ReadOnlyVehiclePort'))failures.push('read-only vehicle integration contract missing or weakened');
if(!contractsPackage.includes('"./vehicle-readonly":"./src/vehicle-readonly.ts"'))failures.push('read-only vehicle contract package export missing');
if(!edgeGuard.includes('DEFAULT_MAX_SESSIONS')||!edgeGuard.includes("'session-capacity'"))failures.push('edge replay-session storage must remain bounded and fail closed at capacity');
if(!clientError.includes('MAX_RATE_KEYS=256')||!clientError.includes("error:'client-report-rate-limited'")||!clientError.includes('function redact('))failures.push('client-error ingestion hardening contract missing');
if(!updateVerifier.includes('verifyUpdatePackage')||!updateVerifier.includes('artifact-hash-mismatch')||!updateVerifier.includes('rollback-rejected')||!updateVerifier.includes('evaluateInstallEligibility'))failures.push('signed update verification/install eligibility contract missing');
for(const requiredOwnerPath of ['/safety/','/services/risk-engine/','/edge/','/packages/contracts/','/.github/workflows/'])if(!codeowners.includes(requiredOwnerPath))failures.push(`CODEOWNERS missing ${requiredOwnerPath}`);
if(failures.length){console.error('KINGMAST engineering evidence check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST engineering evidence check passed.');
