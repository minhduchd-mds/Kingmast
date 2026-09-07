import {readFileSync} from 'node:fs';

const path='docs/validation/hil/V006_BOOT_SECURITY_EVIDENCE_REGISTRY.json';
const data=JSON.parse(readFileSync(path,'utf8'));
const failures=[];
if(data.schema!=='kingmast-boot-security-evidence/v1')failures.push('invalid boot-security evidence schema');
if(data.controlAuthority!=='none')failures.push('boot-security evidence must preserve no-actuation authority');
if(!Array.isArray(data.scenarios)||data.scenarios.length<7)failures.push('boot-security registry must contain the required physical scenarios');
const ids=new Set();
let claimed=0;
for(const scenario of data.scenarios??[]){
  if(!/^BOOT-\d{3}$/.test(scenario.id??''))failures.push(`invalid scenario id ${scenario.id??'<missing>'}`);
  if(ids.has(scenario.id))failures.push(`duplicate scenario ${scenario.id}`);ids.add(scenario.id);
  if(!['pending','passed','failed'].includes(scenario.status))failures.push(`${scenario.id}: invalid status`);
  if(scenario.status==='pending'){
    if(scenario.evidence!==null)failures.push(`${scenario.id}: pending evidence must be null`);
    continue;
  }
  claimed+=1;
  const e=scenario.evidence;
  if(!e||typeof e!=='object')failures.push(`${scenario.id}: physical result requires evidence metadata`);
  else{
    if(!/^[a-f0-9]{40}$/i.test(e.commit??''))failures.push(`${scenario.id}: full commit SHA required`);
    for(const field of ['hardwareId','bootloaderVersion','toolchain','operator','independentReviewer'])if(typeof e[field]!=='string'||!e[field].trim())failures.push(`${scenario.id}: ${field} required`);
    if(typeof e.testedAt!=='string'||Number.isNaN(Date.parse(e.testedAt)))failures.push(`${scenario.id}: testedAt RFC3339 required`);
    if(!Array.isArray(e.artifacts)||e.artifacts.length===0||e.artifacts.some((item)=>typeof item!=='string'||!item.trim()))failures.push(`${scenario.id}: evidence artifact references required`);
  }
}
if(claimed===0&&data.claim!=='no-physical-boot-security-results-claimed')failures.push('baseline claim must state that no physical boot-security result is claimed');
if(claimed>0&&data.claim==='no-physical-boot-security-results-claimed')failures.push('registry claim conflicts with physical results');
if(failures.length){console.error('KINGMAST boot-security evidence registry failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`KINGMAST boot-security evidence registry passed: ${claimed} physical result(s) claimed.`);
