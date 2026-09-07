import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/updates/V006_FIRMWARE_TRUST_EVIDENCE.json');
const failures=[];
if(!existsSync(path))failures.push('firmware trust evidence registry is missing');
let registry=null;
if(!failures.length){
  try{registry=JSON.parse(readFileSync(path,'utf8'));}catch{failures.push('firmware trust evidence registry must be valid JSON');}
}

const requiredIds=['FW-001','FW-002','FW-003','FW-004','FW-005','FW-006','FW-007','FW-008'];
const validStatuses=new Set(['pending','passed','failed']);
if(registry){
  if(registry.schema!=='kingmast-firmware-trust-evidence/v1')failures.push('unexpected firmware trust evidence schema');
  if(registry.product!=='KINGMAST'||registry.version!=='0.0.6')failures.push('firmware evidence product/version mismatch');
  if(registry.controlAuthority!=='none')failures.push('firmware evidence must preserve zero actuator authority');
  if(!Array.isArray(registry.controls))failures.push('firmware controls must be an array');
  else{
    const ids=new Set();
    for(const control of registry.controls){
      if(typeof control.controlId!=='string'||ids.has(control.controlId))failures.push(`invalid or duplicate firmware control ${control.controlId??'<missing>'}`);
      ids.add(control.controlId);
      if(!validStatuses.has(control.status))failures.push(`firmware control ${control.controlId} has invalid status`);
      if(control.required!==true)failures.push(`firmware control ${control.controlId} must remain required`);
      if(control.status==='pending'&&control.evidence!==null)failures.push(`pending firmware control ${control.controlId} must not contain claimed evidence`);
      if(control.status!=='pending'){
        const evidence=control.evidence;
        if(!evidence||typeof evidence!=='object')failures.push(`firmware control ${control.controlId} claim requires evidence`);
        else{
          if(!/^[a-f0-9]{40}$/i.test(evidence.commitSha??''))failures.push(`firmware control ${control.controlId} evidence requires full commit SHA`);
          if(typeof evidence.hardwareId!=='string'||evidence.hardwareId.length<2)failures.push(`firmware control ${control.controlId} evidence requires hardwareId`);
          if(typeof evidence.toolchainVersion!=='string'||evidence.toolchainVersion.length<2)failures.push(`firmware control ${control.controlId} evidence requires toolchainVersion`);
          if(typeof evidence.operator!=='string'||evidence.operator.length<2)failures.push(`firmware control ${control.controlId} evidence requires operator`);
          if(typeof evidence.independentReviewer!=='string'||evidence.independentReviewer.length<2)failures.push(`firmware control ${control.controlId} evidence requires independent reviewer`);
          if(!Array.isArray(evidence.evidenceRefs)||evidence.evidenceRefs.length<1||evidence.evidenceRefs.some((item)=>typeof item!=='string'||item.length<3))failures.push(`firmware control ${control.controlId} evidence requires references`);
          const started=Date.parse(evidence.startedAt??'');
          const ended=Date.parse(evidence.endedAt??'');
          if(!Number.isFinite(started)||!Number.isFinite(ended)||ended<started)failures.push(`firmware control ${control.controlId} evidence requires a valid time window`);
        }
      }
    }
    for(const id of requiredIds)if(!ids.has(id))failures.push(`required firmware control missing: ${id}`);
    if(ids.size!==requiredIds.length)failures.push('firmware evidence registry must contain exactly the required v0.0.6 controls');
    const allPassed=registry.controls.every((control)=>control.status==='passed');
    if(registry.releaseStatus==='production-firmware-trust-verified'&&!allPassed)failures.push('production firmware trust cannot be claimed until every required control is passed');
    if(registry.releaseStatus==='no-production-firmware-release-claimed'&&registry.controls.some((control)=>control.status==='passed'))failures.push('baseline no-production-claim registry must not silently contain passed hardware claims');
    if(!['no-production-firmware-release-claimed','production-firmware-trust-verified'].includes(registry.releaseStatus))failures.push('invalid firmware releaseStatus');
  }
}

if(failures.length){console.error('KINGMAST firmware trust evidence check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST firmware trust evidence registry passed: no production firmware trust is claimed.');
