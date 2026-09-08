import { buildFieldDiagnosticsReport,fieldDiagnosticIdentityFromEnv } from './field-diagnostics.js';

function parseRuntimeInput(){
  const raw=(process.env.KINGMAST_FIELD_DIAGNOSTICS_INPUT_JSON??'').trim();
  if(!raw)return undefined;
  return JSON.parse(raw) as unknown;
}

const physicalVehicleComputerTest=process.env.KINGMAST_PHYSICAL_VEHICLE_COMPUTER_TEST==='1';
const report=buildFieldDiagnosticsReport({
  identity:fieldDiagnosticIdentityFromEnv(),
  runtime:parseRuntimeInput(),
  physicalVehicleComputerTest,
});

console.log(JSON.stringify(report,null,2));

if(process.env.KINGMAST_REQUIRE_PHYSICAL_FIELD_CAPTURE==='1'&&!report.physicalCaptureReady){
  console.error('KINGMAST physical field diagnostics capture is incomplete: target/build/firmware/configuration/calibration identity and hashed hardware instance identity are required.');
  process.exitCode=1;
}
