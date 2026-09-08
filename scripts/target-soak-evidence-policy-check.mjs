import { readFile } from 'node:fs/promises';

const path=new URL('../docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json',import.meta.url);
const report=JSON.parse(await readFile(path,'utf8'));

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

if(report.status==='pending-physical-execution'){
  expect(report.physicalVehicleComputerTest===false,'pending registry must not claim a physical execution');
  for(const key of ['hardwareTarget','hardwareInstanceSha256','buildCommit','buildId','firmwareRevision','configurationRevision','calibrationRevision','capturedDurationSeconds','hostSoakReportSha256','classificationPassed','memoryPassed','eventLoopPassed']){
    expect(report[key]===null,`pending registry must keep ${key} null`);
  }
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
  expect(report.reviewStatus==='pending-independent-review','physical capture still requires independent review');
}

if(process.exitCode)process.exit(process.exitCode);
console.log(`[target-soak-policy] ${report.status}; physical=${report.physicalVehicleComputerTest}; required=${report.requiredDurationSeconds}s; qualification=false`);
