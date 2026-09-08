import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json');
const manifest=JSON.parse(readFileSync(path,'utf8'));
const failures=[];
function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\r\n\t]/.test(value);}

if(manifest.schema!=='kingmast-hil-execution-manifest/v1')fail('unexpected HIL execution manifest schema');
if(manifest.version!=='0.0.6')fail('HIL execution manifest version must remain 0.0.6');
if(manifest.controlAuthority!=='none')fail('HIL execution manifest controlAuthority must remain none');
if(manifest.physicalExecutionRequired!==true)fail('physicalExecutionRequired must remain true');
if(manifest.automaticQualification!==false)fail('automaticQualification must remain false');
if(manifest.captureRoot!=='/var/lib/kingmast/hil-captures')fail('captureRoot must remain fixed to the approved physical runner directory');
if(!Array.isArray(manifest.scenarios)||manifest.scenarios.length!==12)fail('exactly 12 HIL execution scenarios are required');
else{
  const ids=new Set();
  for(const scenario of manifest.scenarios){
    if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)){fail('scenario must be an object');continue;}
    if(!/^HIL-\d{3}$/.test(scenario.id)||ids.has(scenario.id))fail(`invalid or duplicate HIL id ${String(scenario.id)}`);
    ids.add(scenario.id);
    if(!label(scenario.title))fail(`${scenario.id}: title is required`);
    if(scenario.captureFile!==`${scenario.id}.json`)fail(`${scenario.id}: captureFile must be ${scenario.id}.json`);
    if(!Array.isArray(scenario.requiredResultKeys)||scenario.requiredResultKeys.length<6||scenario.requiredResultKeys.some((item)=>!label(item)))fail(`${scenario.id}: at least six requiredResultKeys are required`);
    if(!scenario.requiredResultKeys.includes('controllerId')||!scenario.requiredResultKeys.includes('benchId'))fail(`${scenario.id}: controllerId and benchId are mandatory`);
  }
  for(let index=1;index<=12;index+=1){const id=`HIL-${String(index).padStart(3,'0')}`;if(!ids.has(id))fail(`missing ${id}`);}
}
const promotion=manifest.promotionRule;
if(!promotion||promotion.initialStatus!=='captured-awaiting-independent-review'||promotion.registryMutationByWorkflow!==false||promotion.passRequiresIndependentReviewer!==true||promotion.targetHardwareQualified!==false||promotion.publicRoadApproved!==false)fail('HIL promotion rule must remain fail-closed and independently reviewed');

if(failures.length){
  console.error('KINGMAST HIL execution manifest policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log('KINGMAST HIL execution manifest valid for 12 physical scenarios; automatic qualification disabled.');
