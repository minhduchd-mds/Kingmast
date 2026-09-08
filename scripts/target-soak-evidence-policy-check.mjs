import { readFile } from 'node:fs/promises';

const registryPath=new URL('../docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json',import.meta.url);
const workflowPath=new URL('../.github/workflows/target-hardware-capture.yml',import.meta.url);
const report=JSON.parse(await readFile(registryPath,'utf8'));
const workflow=await readFile(workflowPath,'utf8');

function fail(message){console.error(`[target-soak-policy] ${message}`);process.exitCode=1;}
function expect(condition,message){if(!condition)fail(message);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function label(value){return typeof value==='string'&&value.length>=1&&value.length<=96&&!/[\r\n\t]/.test(value);}

expect(report.schema==='kingmast-target-soak-capture/v1','unexpected schema');
expect(report.productVersion==='0.0.6','product version must remain 0.0.6');
expect(report.controlAuthority==='none','control authority must remain none');
expect(report.targetHardwareQualified===false,'target hardware must not be marked qualified by this registry');
expect(Number.isInteger(report.requiredDurationSeconds)&&report.requiredDurationSeconds>=7200,'required duration must be at least two hours');
expect(['pending-physical-execution','captured-awaiting-review'].includes(report.status),'unsupported status');
expect(['not-reviewed','pending-independent-review'].includes(report.reviewStatus),'unsupported review status');

const physicalEvidenceKeys=[
  'hardwareTarget','hardwareInstanceSha256','buildCommit','buildId','firmwareRevision','configurationRevision','calibrationRevision',
  'capturedDurationSeconds','hostSoakReportSha256','classificationPassed','memoryPassed','eventLoopPassed','runtimeEnvelopePassed',
  'thermalTelemetryRequired','thermalAvailable','temperaturePassed','freeMemoryPassed',
];

if(report.status==='pending-physical-execution'){
  expect(report.physicalVehicleComputerTest===false,'pending registry must not claim a physical execution');
  for(const key of physicalEvidenceKeys)expect(report[key]===null,`pending registry must keep ${key} null`);
}else{
  expect(report.physicalVehicleComputerTest===true,'captured registry requires physicalVehicleComputerTest=true');
  expect(label(report.hardwareTarget),'captured registry requires hardware target');
  expect(sha256(report.hardwareInstanceSha256),'captured registry requires hashed hardware instance identity');
  expect(label(report.buildCommit),'captured registry requires build commit');
  expect(label(report.buildId),'captured registry requires build id');
  expect(label(report.firmwareRevision),'captured registry requires firmware revision');
  expect(label(report.configurationRevision),'captured registry requires configuration revision');
  expect(label(report.calibrationRevision),'captured registry requires calibration revision');
  expect(Number.isFinite(report.capturedDurationSeconds)&&report.capturedDurationSeconds>=report.requiredDurationSeconds,'captured duration is below required duration');
  expect(sha256(report.hostSoakReportSha256),'captured registry requires SHA-256 of the host-soak report');
  expect(report.classificationPassed===true,'classification evidence must pass');
  expect(report.memoryPassed===true,'memory evidence must pass');
  expect(report.eventLoopPassed===true,'event-loop evidence must pass');
  expect(report.runtimeEnvelopePassed===true,'runtime-envelope evidence must pass');
  expect(typeof report.thermalTelemetryRequired==='boolean','captured registry must record whether thermal telemetry was required');
  expect(typeof report.thermalAvailable==='boolean','captured registry must record whether thermal telemetry was available');
  expect(typeof report.temperaturePassed==='boolean','captured registry must record temperature budget result');
  expect(report.temperaturePassed===true,'captured registry temperature budget must pass');
  if(report.thermalTelemetryRequired===true)expect(report.thermalAvailable===true,'required thermal telemetry must be available');
  expect(report.freeMemoryPassed===true,'captured registry free-memory budget must pass');
  expect(report.reviewStatus==='pending-independent-review','physical capture still requires independent review');
}

expect(/\bworkflow_dispatch\s*:/m.test(workflow),'target capture workflow must remain manual workflow_dispatch only');
expect(!/^\s*push\s*:/m.test(workflow),'target capture workflow must not run on push');
expect(!/^\s*pull_request\s*:/m.test(workflow),'target capture workflow must not run on pull requests');
expect(workflow.includes('runs-on: [self-hosted, linux, kingmast-target]'),'target capture must use the dedicated self-hosted kingmast-target runner label');
expect(workflow.includes('environment: target-hardware-evidence'),'target capture must use the protected target-hardware-evidence environment');
expect(workflow.includes('acknowledge_evidence_only'),'target capture must require explicit evidence-only acknowledgement');
expect(workflow.includes("KINGMAST_PHYSICAL_VEHICLE_COMPUTER_TEST: '1'"),'target workflow must explicitly enter physical capture mode');
expect(workflow.includes("KINGMAST_HOST_SOAK_SECONDS: ${{ inputs.duration_seconds }}"),'target workflow must bind soak duration to validated manual input');
expect(workflow.includes('r.workload?.durationSeconds<7200'),'target workflow must reject captures shorter than two hours');
expect(workflow.includes("r.targetHardwareQualified!==false"),'target workflow must reject any hardware-qualification claim');
expect(workflow.includes('r.runtimeEnvelope?.passed!==true'),'target workflow must require runtime-envelope evidence to pass');
expect(workflow.includes('scripts/capture-target-field-runtime.mjs'),'target workflow must capture fresh bounded field diagnostics from the target service');
expect(workflow.includes('r.physicalCaptureReady!==true'),'target workflow must reject incomplete physical field diagnostics');
expect(workflow.includes('r.health?.coverage?.physicalCoreCoverageComplete!==true'),'target workflow must require explicit core diagnostics coverage');
expect(workflow.includes('kingmast-target-hardware-artifact-manifest/v2'),'target workflow must emit the combined bounded hardware artifact manifest');
expect(workflow.includes('hostSoakReportSha256'),'target workflow manifest must bind the physical soak report');
expect(workflow.includes('fieldDiagnosticsReportSha256'),'target workflow manifest must bind the physical field-diagnostics report');
expect(workflow.includes('providerDiagnosticsCoverageComplete'),'target workflow manifest must preserve provider diagnostics coverage truth');
expect(workflow.includes('rawHardwareSerialIncluded:false'),'target workflow manifest must preserve raw-hardware-serial privacy');
expect(workflow.includes('rawCabinVideoIncluded:false'),'target workflow manifest must preserve raw-cabin-video privacy');
expect(workflow.includes('secretsIncluded:false'),'target workflow manifest must preserve secret-exclusion privacy');

if(process.exitCode)process.exit(process.exitCode);
console.log(`[target-soak-policy] ${report.status}; physical=${report.physicalVehicleComputerTest}; required=${report.requiredDurationSeconds}s; runtime-envelope=${report.runtimeEnvelopePassed??'pending'}; guarded-workflow=true; combined-field-diagnostics=true; qualification=false`);
