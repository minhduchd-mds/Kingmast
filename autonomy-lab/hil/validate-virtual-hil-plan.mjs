import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const plan=JSON.parse(readFileSync(resolve(root,'autonomy-lab/hil/virtual-hil-stimulus-plan.json'),'utf8'));
const registry=JSON.parse(readFileSync(resolve(root,'docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
expect(plan.schema==='kingmast-virtual-hil-stimulus-plan/v1','unexpected virtual HIL plan schema');
expect(plan.version==='0.0.6','virtual HIL plan version must remain 0.0.6');
expect(plan.controlAuthority==='none','virtual HIL controlAuthority must remain none');
expect(plan.qualificationClaim==='virtual-hil-stimulus-planning-only-not-physical-hil','virtual HIL plan must preserve planning-only claim');
expect(plan.canWriteAuthority===false,'virtual HIL plan must not create CAN-write authority');
for(const field of ['physicalHilExecuted','physicalHilQualified','targetHardwareQualified','publicRoadApproved'])expect(plan[field]===false,`${field} must remain false`);
const expectedIds=Array.from({length:12},(_,index)=>`HIL-${String(index+1).padStart(3,'0')}`);
const plannedIds=(plan.scenarios??[]).map((item)=>item.id).sort();
const registryIds=(registry.scenarios??[]).map((item)=>item.id).sort();
expect(JSON.stringify(plannedIds)===JSON.stringify(expectedIds),'virtual plan must cover HIL-001..HIL-012 exactly once');
expect(JSON.stringify(registryIds)===JSON.stringify(expectedIds),'physical HIL registry must cover HIL-001..HIL-012 exactly once');
for(const item of plan.scenarios??[]){
  expect(typeof item.stimulus==='string'&&item.stimulus.length>=12,`${item.id}: stimulus description is required`);
  expect(Array.isArray(item.channels)&&item.channels.length>=1,`${item.id}: at least one stimulus channel is required`);
  expect(typeof item.expectedObservation==='string'&&item.expectedObservation.length>=12,`${item.id}: expected observation is required`);
  expect(item.canTx===false,`${item.id}: CAN transmit authority must remain false`);
  const physical=(registry.scenarios??[]).find((entry)=>entry.id===item.id);
  expect(physical?.status==='pending',`${item.id}: virtual planning must not promote the physical registry`);
  expect(physical?.evidence===null,`${item.id}: physical evidence must remain null until a genuine bench run`);
}
if(failures.length){console.error('KINGMAST virtual HIL plan validation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[virtual-hil-plan] scenarios=${plannedIds.length}; can-write=false; physical-hil-executed=false; registry-status=pending`);
