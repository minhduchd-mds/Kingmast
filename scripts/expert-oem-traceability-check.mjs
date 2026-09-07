import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const read=(path)=>{
  const full=resolve(root,path);
  if(!existsSync(full))throw new Error(`Missing required traceability material: ${path}`);
  return readFileSync(full,'utf8');
};

const benchmark=read('docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md');
const traceability=read('docs/research/EXPERT_OEM_TRACEABILITY_V006.md');
const humanFactors=read('docs/hmi/HUMAN_FACTORS_EVIDENCE_V006.md');
const risk=read('services/risk-engine/src/risk.ts');
const deviceAuth=read('services/risk-engine/src/device-auth.ts');
const updateVerifier=read('services/risk-engine/src/update-verifier.ts');
const vehiclePort=read('packages/contracts/src/vehicle-readonly.ts');
const hmiEvidence=read('apps/hmi/scripts/human-factors-evidence.mjs');

const failures=[];
const requireText=(source,text,label)=>{if(!source.includes(text))failures.push(label);};

requireText(benchmark,'public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation','clean-room transformation rule missing');
for(const oem of ['Tesla','BYD','VinFast'])requireText(traceability,oem,`${oem} traceability missing`);
for(const id of [
  'KM-REQ-ATTN-001','KM-REQ-DEGRADE-001','KM-REQ-PRIV-001','KM-REQ-UPD-001',
  'KM-REQ-LIMIT-001','KM-REQ-PRIV-002','KM-REQ-DATA-001','KM-REQ-CSMS-001',
  'KM-REQ-VNODD-001','KM-REQ-FOTA-001','KM-REQ-SDV-001',
])requireText(traceability,id,`${id} mapping missing`);

requireText(traceability,'software-evidence-implemented','software evidence status vocabulary missing');
requireText(traceability,'physical HIL','physical HIL residual gate must remain explicit');
requireText(traceability,'must never convert software evidence','CI claim-boundary wording missing');
requireText(humanFactors,'ci-structural-only-not-user-study','human-factors structural-only claim missing');
requireText(humanFactors,'humanFactorsValidated: false','human-factors non-validation boundary missing');
requireText(risk,'future-data-rejected','future/stale degradation evidence missing');
requireText(deviceAuth,'signDevicePacketEd25519','asymmetric device identity evidence missing');
requireText(updateVerifier,'verifyUpdatePackage','signed update verification evidence missing');
requireText(vehiclePort,"VEHICLE_PORT_AUTHORITY='read-only'",'read-only vehicle authority evidence missing');
requireText(hmiEvidence,"controlAuthority:'none'",'HMI human-factors report must preserve no-control authority');
requireText(hmiEvidence,"qualificationClaim:'ci-structural-only-not-user-study'",'HMI evidence qualification boundary missing');
requireText(hmiEvidence,'humanFactorsValidated:false','HMI evidence must not claim human-factors validation');

if(failures.length){
  for(const failure of failures)console.error(`EXPERT/OEM TRACEABILITY FAIL: ${failure}`);
  process.exit(1);
}
console.log('KINGMAST expert/OEM clean-room traceability passed with physical-validation boundaries preserved.');
