import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const required=[
  'docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md',
  'docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md',
  'docs/safety/ODD_V006.md',
  'docs/safety/HARA_DRAFT_V006.md',
  'docs/safety/SOTIF_SCENARIO_CATALOG_V006.md',
  'docs/safety/SURROUND_CALIBRATION_MODEL_V006.md',
  'docs/cybersecurity/TARA_V006.md',
  'docs/cybersecurity/DEVICE_IDENTITY_V006.md',
  'docs/hardware/ESP32_SECURITY_BASELINE.md',
  'docs/updates/SUMS_OTA_ARCHITECTURE_V006.md',
  'docs/updates/OTA_STATE_MACHINE_V006.md',
  'docs/validation/SIL_HIL_FAULT_INJECTION_PLAN_V006.md',
  'docs/validation/scenarios/V006_BASELINE.json',
  'docs/architecture/READ_ONLY_VEHICLE_PORT.md',
  'docs/supplychain/BUILD_PROVENANCE_V006.md',
  'docs/observability/AUDIT_JOURNAL_V006.md',
  'docs/observability/RUNTIME_METRICS_V006.md',
  'docs/governance/MAIN_BRANCH_PROTECTION.md',
  'packages/contracts/src/vehicle-readonly.ts',
  'services/risk-engine/src/update-verifier.ts',
  'services/risk-engine/src/update-verifier.test.ts',
  'services/risk-engine/src/update-state.ts',
  'services/risk-engine/src/update-state.test.ts',
  'services/risk-engine/src/driver-monitoring.ts',
  'services/risk-engine/src/driver-assist-runtime.ts',
  'services/risk-engine/src/risk-observability.ts',
  'services/risk-engine/src/risk-observability.test.ts',
  'services/risk-engine/src/safety-scenarios.test.ts',
  'services/risk-engine/src/bounded-state.ts',
  'services/risk-engine/src/bounded-state.test.ts',
  'services/risk-engine/src/device-auth.ts',
  'services/risk-engine/src/device-auth.test.ts',
  'services/risk-engine/src/audit-journal.ts',
  'services/risk-engine/src/audit-journal.test.ts',
  'scripts/architecture-boundary-check.mjs',
  'scripts/secret-scan.mjs',
  'scripts/firmware-security-policy-check.mjs',
  'scripts/generate-sbom.mjs',
  'scripts/generate-build-provenance.mjs',
  '.github/workflows/codeql.yml',
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  '.github/pull_request_template.md',
];
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
for(const path of required)read(path);
const plan=read('docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md');
const odd=read('docs/safety/ODD_V006.md');
const hara=read('docs/safety/HARA_DRAFT_V006.md');
const sotif=read('docs/safety/SOTIF_SCENARIO_CATALOG_V006.md');
const surroundModel=read('docs/safety/SURROUND_CALIBRATION_MODEL_V006.md');
const research=read('docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md');
const deviceIdentityDoc=read('docs/cybersecurity/DEVICE_IDENTITY_V006.md');
const hardwareBaseline=read('docs/hardware/ESP32_SECURITY_BASELINE.md');
const otaStateDoc=read('docs/updates/OTA_STATE_MACHINE_V006.md');
const buildProvenanceDoc=read('docs/supplychain/BUILD_PROVENANCE_V006.md');
const auditDoc=read('docs/observability/AUDIT_JOURNAL_V006.md');
const runtimeMetricsDoc=read('docs/observability/RUNTIME_METRICS_V006.md');
const governanceDoc=read('docs/governance/MAIN_BRANCH_PROTECTION.md');
const vehiclePort=read('packages/contracts/src/vehicle-readonly.ts');
const contractsPackage=read('packages/contracts/package.json');
const contracts=read('packages/contracts/src/index.ts');
const edgeGuard=read('services/risk-engine/src/edge-guard.ts');
const boundedState=read('services/risk-engine/src/bounded-state.ts');
const roadContextRoutes=read('services/risk-engine/src/road-context-routes.ts');
const clientError=read('apps/hmi/app/api/kingmast/client-error/route.ts');
const updateVerifier=read('services/risk-engine/src/update-verifier.ts');
const updateState=read('services/risk-engine/src/update-state.ts');
const dms=read('services/risk-engine/src/driver-monitoring.ts');
const driverAssistRuntime=read('services/risk-engine/src/driver-assist-runtime.ts');
const risk=read('services/risk-engine/src/risk.ts');
const riskMetrics=read('services/risk-engine/src/risk-observability.ts');
const deviceAuth=read('services/risk-engine/src/device-auth.ts');
const auditJournal=read('services/risk-engine/src/audit-journal.ts');
const eventBuffer=read('services/risk-engine/src/event-buffer.ts');
const riskServer=read('services/risk-engine/src/server.ts');
const architectureBoundary=read('scripts/architecture-boundary-check.mjs');
const secretScan=read('scripts/secret-scan.mjs');
const firmwarePolicy=read('scripts/firmware-security-policy-check.mjs');
const sbom=read('scripts/generate-sbom.mjs');
const provenance=read('scripts/generate-build-provenance.mjs');
const ci=read('.github/workflows/ci.yml');
const codeql=read('.github/workflows/codeql.yml');
const dependabot=read('.github/dependabot.yml');
const prTemplate=read('.github/pull_request_template.md');
const scenarioTests=read('services/risk-engine/src/safety-scenarios.test.ts');
const codeowners=read('.github/CODEOWNERS');
if(!/warning-only/i.test(plan)||!/no steering|no code path.*actuator|vehicle actuation is prohibited/i.test(plan))failures.push('program plan must preserve explicit Level-0/no-actuation boundary');
if(!/Public-road deployment is outside this ODD/i.test(odd))failures.push('ODD must keep public-road deployment outside v0.0.6 research boundary');
if(!/public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation/i.test(research))failures.push('clean-room research transformation rule missing');
if(!vehiclePort.includes("VEHICLE_PORT_AUTHORITY='read-only'")||!vehiclePort.includes('interface ReadOnlyVehiclePort'))failures.push('read-only vehicle integration contract missing or weakened');
if(!contractsPackage.includes('"./vehicle-readonly":"./src/vehicle-readonly.ts"'))failures.push('read-only vehicle contract package export missing');
if(!architectureBoundary.includes('autonomy-lab')||!architectureBoundary.includes('ReadOnlyVehiclePort')||!ci.includes('pnpm architecture:boundary'))failures.push('production/simulation/read-only dependency architecture gate must remain in CI');
if(!edgeGuard.includes('DEFAULT_MAX_SESSIONS')||!edgeGuard.includes("'session-capacity'"))failures.push('edge replay-session storage must remain bounded and fail closed at capacity');
if(!boundedState.includes('class BoundedFixedWindowRateLimiter')||!boundedState.includes('class BoundedMonotonicTimestampStore'))failures.push('bounded runtime state primitives missing');
if(!roadContextRoutes.includes('BoundedFixedWindowRateLimiter')||!roadContextRoutes.includes('BoundedMonotonicTimestampStore')||!roadContextRoutes.includes("'/v4/runtime/diagnostics'"))failures.push('road-context runtime must use bounded abuse/replay state and authenticated diagnostics');
if(!clientError.includes('MAX_RATE_KEYS=256')||!clientError.includes("error:'client-report-rate-limited'")||!clientError.includes('function redact('))failures.push('client-error ingestion hardening contract missing');
if(!updateVerifier.includes('verifyUpdatePackage')||!updateVerifier.includes('artifact-hash-mismatch')||!updateVerifier.includes('rollback-rejected')||!updateVerifier.includes('evaluateInstallEligibility'))failures.push('signed update verification/install eligibility contract missing');
if(!updateState.includes('class UpdateLifecycle')||!updateState.includes("'pending-boot'")||!updateState.includes("'rollback-required'"))failures.push('fail-safe OTA lifecycle/rollback state machine missing');
if(!otaStateDoc.includes('staged')||!otaStateDoc.includes('pending-boot')||!otaStateDoc.includes('rollback-required'))failures.push('OTA lifecycle documentation must preserve verified install and rollback states');
if(!dms.includes('MAX_SAMPLE_GAP_MS')||!dms.includes("'insufficient-temporal-span'")||!dms.includes("'cabin-observation-discontinuous'"))failures.push('DMS must fail closed on compressed or discontinuous temporal evidence');
if(!driverAssistRuntime.includes('DMS_HARD_UNAVAILABLE_REASONS')||!driverAssistRuntime.includes("'cabin-observation-discontinuous'"))failures.push('DMS runtime availability must represent hard cabin-observation loss as unavailable');
if(!contracts.includes('geometryConfidence:number')||!contracts.includes('calibrationUncertaintyPx:number|null')||!driverAssistRuntime.includes('fullyReady')||!driverAssistRuntime.includes('readyCameraCount'))failures.push('surround runtime must expose calibration uncertainty and complete-camera readiness');
if(!surroundModel.includes('every configured camera')||!surroundModel.includes('visualization-only'))failures.push('surround calibration model must preserve complete-camera and visualization-only safety boundary');
if(!deviceAuth.includes('verifyDevicePacketAuth')||!deviceAuth.includes("createHmac('sha256'")||!deviceAuth.includes('signDevicePacketEd25519')||!deviceAuth.includes('createPublicKey')||!deviceAuth.includes("'device-key-revoked'"))failures.push('per-device HMAC/Ed25519 identity, rotation and revocation contract missing');
if(!deviceIdentityDoc.includes('server stores only the device public key')||!deviceIdentityDoc.includes('must not be described as fleet-grade PKI')||!deviceIdentityDoc.includes('hardware-protected non-exportable private key'))failures.push('device identity documentation must preserve asymmetric migration and non-PKI claim boundary');
if(!riskServer.includes('KINGMAST_REQUIRE_DEVICE_AUTH')||!riskServer.includes('requireEdgePacketAuth')||!riskServer.includes("'/v3/device-identity/status'"))failures.push('risk engine must expose and enforce the per-device edge-frame identity transition');
if(!auditJournal.includes('class BoundedAuditJournal')||!auditJournal.includes('KINGMAST_AUDIT_JOURNAL_PATH')||!auditJournal.includes("kingmast-audit-event/v1")||!eventBuffer.includes('createAuditJournalFromEnv')||!eventBuffer.includes('auditStatus'))failures.push('bounded local audit-journal evidence contract missing');
if(!auditDoc.includes('does not store raw continuous camera video')||!auditDoc.includes('warning path depend on storage availability'))failures.push('audit journal documentation must preserve metadata-only and safety-operation independence boundaries');
if(!riskMetrics.includes('class BoundedRiskMetrics')||!riskMetrics.includes('latencyMs')||!riskMetrics.includes('gt25')||!risk.includes('riskRuntimeMetrics.observe'))failures.push('bounded deterministic risk observability contract missing');
if(!riskServer.includes("'/v3/audit/status'")||!riskServer.includes('riskMetricsSnapshot()')||!riskServer.includes('eventBuffer.auditStatus()'))failures.push('authenticated risk/audit observability routes missing');
if(!runtimeMetricsDoc.includes('fixed-size counters/buckets')||!runtimeMetricsDoc.includes('never vehicle-control inputs')||!runtimeMetricsDoc.includes('must not change deterministic warning decisions'))failures.push('runtime observability documentation must preserve fixed-cardinality and no-control boundaries');
if(!secretScan.includes('KINGMAST repository secret scan failed')||!ci.includes('pnpm security:secrets'))failures.push('repository high-confidence secret scan must remain in CI');
if(!firmwarePolicy.includes('setInsecure')||!firmwarePolicy.includes('setCACert')||!ci.includes('pnpm firmware:policy'))failures.push('ESP32 firmware security policy must remain enforced in CI');
if(!hardwareBaseline.includes('secure boot')||!hardwareBaseline.includes('hardware-protected key')||!hardwareBaseline.includes('read-only'))failures.push('ESP32 hardware security baseline must preserve secure-boot/key-storage/read-only targets');
if(!sbom.includes("bomFormat:'CycloneDX'")||!sbom.includes("specVersion:'1.5'")||!ci.includes('node scripts/generate-sbom.mjs'))failures.push('CycloneDX production dependency SBOM generation must remain in CI');
if(!provenance.includes("schema:'kingmast-build-provenance/v1'")||!provenance.includes("actuatorAuthority:'none'")||!provenance.includes('KINGMAST_BUILD_PATHS')||!ci.includes('Generate build provenance')||!ci.includes('/tmp/kingmast.provenance.json')||!ci.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'))failures.push('build provenance / pinned evidence upload contract missing');
if(!buildProvenanceDoc.includes('GITHUB_SHA')||!buildProvenanceDoc.includes('actuatorAuthority: none')||!/not a standards certification/i.test(buildProvenanceDoc))failures.push('build provenance documentation must preserve source identity, no-actuation and non-certification boundaries');
if(!dependabot.includes('package-ecosystem: npm')||!dependabot.includes('package-ecosystem: github-actions')||!dependabot.includes('open-pull-requests-limit'))failures.push('bounded dependency and GitHub Actions update policy missing');
if(!prTemplate.includes('warning-only / advisory-only Level-0')||!prTemplate.includes('No secrets')||!prTemplate.includes('public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation'))failures.push('safety/security/clean-room pull request review template missing');
if(!governanceDoc.includes('no direct force-pushes')||!governanceDoc.includes('CI / verify')||!governanceDoc.includes('CodeQL / Analyze JavaScript/TypeScript')||!governanceDoc.includes('requires GitHub repository administration'))failures.push('main branch protection target policy missing or weakened');
if(!ci.includes('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1')||!ci.includes('actions/setup-node@820762786026740c76f36085b0efc47a31fe5020')||!ci.includes('pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413'))failures.push('core CI actions must remain pinned to reviewed immutable commits');
if(!codeql.includes('github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938')||!codeql.includes('github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938'))failures.push('CodeQL workflow must remain pinned to the reviewed v4 commit');
for(const requiredOwnerPath of ['/safety/','/services/risk-engine/','/edge/','/packages/contracts/','/.github/workflows/'])if(!codeowners.includes(requiredOwnerPath))failures.push(`CODEOWNERS missing ${requiredOwnerPath}`);

try{
  const scenarios=JSON.parse(read('docs/validation/scenarios/V006_BASELINE.json'));
  if(!Array.isArray(scenarios)||scenarios.length<14)failures.push('baseline validation scenario manifest must contain at least fourteen traceable scenarios');
  else for(const scenario of scenarios){
    if(typeof scenario.scenarioId!=='string'||!scenarioTests.includes(scenario.scenarioId))failures.push(`scenario test missing ${scenario.scenarioId??'unknown-id'}`);
    for(const hazardId of scenario.hazardIds??[])if(!hara.includes(hazardId))failures.push(`scenario ${scenario.scenarioId} references unknown hazard ${hazardId}`);
    for(const goalId of scenario.safetyGoalIds??[])if(!hara.includes(goalId))failures.push(`scenario ${scenario.scenarioId} references unknown safety goal ${goalId}`);
    for(const sotifId of scenario.sotifIds??[])if(!sotif.includes(sotifId))failures.push(`scenario ${scenario.scenarioId} references unknown SOTIF scenario ${sotifId}`);
  }
}catch{failures.push('baseline validation scenario manifest must be valid JSON');}

if(failures.length){console.error('KINGMAST engineering evidence check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST engineering evidence check passed.');
