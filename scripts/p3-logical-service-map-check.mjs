import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const map=JSON.parse(readFileSync(resolve(process.cwd(),'docs/architecture/P3_LOGICAL_SERVICE_MAP.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
expect(map.schema==='kingmast-logical-service-map/v1','unexpected logical service map schema');
expect(map.version==='0.0.6','logical service map version must remain 0.0.6');
expect(map.controlAuthority==='none','architecture must preserve controlAuthority=none');
expect(map.deploymentPolicy?.forcedMicroserviceSplit===false,'logical components must not force a 40-process microservice split');
expect(map.deploymentPolicy?.localSafetyPathRequired===true,'immediate warning path must remain local');
expect(map.deploymentPolicy?.cloudInImmediateWarningPath===false,'cloud must not own the immediate warning path');
expect(map.deploymentPolicy?.automaticActuation===false,'architecture must not enable automatic actuation');
expect(map.deploymentPolicy?.canWriteAuthority===false,'architecture must not enable CAN write authority');
const components=Array.isArray(map.components)?map.components:[];
expect(components.length===40,'P3 logical architecture must define exactly 40 bounded components');
const ids=new Set();
const groups=new Set();
for(const component of components){
  expect(typeof component.id==='string'&&/^[a-z0-9-]{3,64}$/.test(component.id),`invalid component id ${String(component.id)}`);
  if(ids.has(component.id))failures.push(`duplicate component id ${component.id}`);else ids.add(component.id);
  expect(['safety-runtime','perception-runtime','context-runtime','platform-runtime','hmi-runtime','evidence-runtime'].includes(component.group),`${component.id}: unsupported process group`);
  groups.add(component.group);
  expect(['high','medium','low'].includes(component.criticality),`${component.id}: invalid criticality`);
  expect(['immediate-warning','interactive','background'].includes(component.latencyClass),`${component.id}: invalid latency class`);
  expect(typeof component.cloudDependent==='boolean',`${component.id}: cloudDependent must be boolean`);
  if(component.latencyClass==='immediate-warning')expect(component.cloudDependent===false,`${component.id}: immediate-warning component cannot depend on cloud`);
}
for(const required of ['edge-packet-guard','sensor-freshness','sensor-fusion','forward-risk','blind-spot','rear-cross-traffic','lane-departure','driver-monitoring','alert-arbitration','runtime-health','warning-hmi','can-read-adapter','update-verifier','evidence-anchor'])expect(ids.has(required),`missing required logical component ${required}`);
expect(groups.size===6,'all six logical process groups must be represented');
if(failures.length){console.error('KINGMAST P3 logical service map validation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[p3-service-map] logical-components=${components.length}; process-groups=${groups.size}; forced-microservice-split=false; immediate-warning-cloud-dependency=false; control-authority=none`);
