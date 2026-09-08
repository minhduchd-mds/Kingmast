import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const map=JSON.parse(readFileSync(resolve(root,'autonomy-lab/validation/virtual-to-physical-map.json'),'utf8'));
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
const hil=JSON.parse(readFileSync(resolve(root,'docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json'),'utf8'));
const track=JSON.parse(readFileSync(resolve(root,'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(map.schema==='kingmast-virtual-to-physical-validation-map/v1','unexpected virtual-to-physical map schema');
expect(map.version==='0.0.6','virtual-to-physical map version must remain 0.0.6');
expect(map.controlAuthority==='none','virtual-to-physical map must preserve controlAuthority=none');
expect(map.qualificationClaim==='traceability-map-only-not-physical-validation','traceability map must preserve research-only claim');
expect(map.automaticPhysicalPass===false,'virtual evidence must never create automatic physical pass');
expect(map.publicRoadApproved===false,'virtual-to-physical map must never approve public-road use');

const hilIds=new Set((hil.scenarios??[]).map((item)=>item.id));
const trackIds=new Set((track.scenarios??[]).map((item)=>item.id));
const mappedDomains=new Map((map.domains??[]).map((item)=>[item.domain,item]));
const scenarioDomains=new Set((library.scenarios??[]).map((item)=>item.domain));
for(const domain of scenarioDomains)expect(mappedDomains.has(domain),`simulation domain ${domain} is missing virtual-to-physical mapping`);
for(const entry of map.domains??[]){
  expect(scenarioDomains.has(entry.domain),`mapped domain ${entry.domain} has no independent simulation scenario`);
  expect(Array.isArray(entry.hil)&&Array.isArray(entry.closedTrack),`${entry.domain}: hil/closedTrack arrays are required`);
  expect((entry.hil.length+entry.closedTrack.length)>=1,`${entry.domain}: at least one physical evidence destination is required`);
  for(const id of entry.hil)expect(hilIds.has(id),`${entry.domain}: unknown HIL id ${id}`);
  for(const id of entry.closedTrack)expect(trackIds.has(id),`${entry.domain}: unknown controlled-track id ${id}`);
  expect(typeof entry.intent==='string'&&entry.intent.length>=20&&entry.intent.length<=360,`${entry.domain}: bounded mapping intent is required`);
}
for(const item of hil.scenarios??[])expect(item.status==='pending'||item.status==='captured-awaiting-review',`${item.id}: mapping validation cannot rely on an invalid HIL status`);
expect(hil.claim==='no-hil-results-claimed','HIL registry must continue to make no result claim before physical evidence exists');
expect(track.closedTrackApproved===false&&track.publicRoadApproved===false&&track.targetHardwareQualified===false,'controlled-track registry must remain fail-closed');
expect(typeof map.promotionRule==='string'&&map.promotionRule.includes('engineering review')&&map.promotionRule.includes('independent review'),'promotion rule must require engineering and independent review');

if(failures.length){console.error('KINGMAST virtual-to-physical validation map failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[virtual-to-physical-map] domains=${map.domains.length}; hil-destinations=${hilIds.size}; track-destinations=${trackIds.size}; physical-pass=false; public-road-approved=false`);
