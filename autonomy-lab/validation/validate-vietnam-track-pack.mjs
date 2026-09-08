import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const pack=JSON.parse(readFileSync(resolve(root,'autonomy-lab/validation/vietnam-controlled-track-pack.json'),'utf8'));
const track=JSON.parse(readFileSync(resolve(root,'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json'),'utf8'));
const sources=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-research/source-registry.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
const sourceIds=new Set((sources.sources??[]).map((item)=>item.id));
const trackIds=new Set((track.scenarios??[]).map((item)=>item.id));

expect(pack.schema==='kingmast-vietnam-controlled-track-research-pack/v1','unexpected Vietnam track-pack schema');
expect(pack.version==='0.0.6','Vietnam track pack version must remain 0.0.6');
expect(pack.controlAuthority==='none','Vietnam track pack must preserve controlAuthority=none');
expect(pack.qualificationClaim==='research-scenario-pack-only-not-track-approval-or-road-authorization','Vietnam track pack must preserve research-only claim');
expect(pack.country==='VN','Vietnam track pack country must be VN');
expect(pack.syntheticGeometryOnly===true&&pack.realWorldCoordinatesIncluded===false,'Vietnam track pack must use synthetic geometry without real-world coordinates');
expect(pack.automaticTestAuthorization===false&&pack.publicRoadApproved===false,'Vietnam research pack must never authorize track or public-road execution');
expect(Array.isArray(pack.profiles)&&pack.profiles.length===8,'Vietnam track pack must cover all eight controlled-track scenarios');
expect(Array.isArray(pack.mandatoryPrerequisites)&&pack.mandatoryPrerequisites.length>=8,'Vietnam track pack must retain bounded physical prerequisites');
for(const ref of pack.sourceRefs??[])expect(sourceIds.has(ref),`Vietnam track pack references unknown source ${ref}`);
const seen=new Set();
for(const profile of pack.profiles??[]){
  expect(/^VN-CT-00[1-8]$/.test(profile.id),`${profile.id}: invalid Vietnam profile id`);
  expect(trackIds.has(profile.closedTrackScenario),`${profile.id}: unknown controlled-track scenario ${profile.closedTrackScenario}`);
  expect(!seen.has(profile.closedTrackScenario),`${profile.id}: duplicate controlled-track mapping ${profile.closedTrackScenario}`);seen.add(profile.closedTrackScenario);
  expect(Array.isArray(profile.actors)&&profile.actors.length>=1&&profile.actors.length<=6,`${profile.id}: actors must contain 1..6 bounded surrogate roles`);
  expect(typeof profile.researchIntent==='string'&&profile.researchIntent.length>=40&&profile.researchIntent.length<=320,`${profile.id}: bounded research intent is required`);
  expect(!JSON.stringify(profile).match(/\b(?:lat|lng|longitude|latitude)\b/i),`${profile.id}: real-world coordinate fields are forbidden`);
}
for(const id of trackIds)expect(seen.has(id),`Vietnam track pack is missing ${id}`);
expect(track.closedTrackApproved===false&&track.publicRoadApproved===false,'physical controlled-track registry must remain fail-closed');
if(failures.length){console.error('KINGMAST Vietnam controlled-track research pack failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[vietnam-track-pack] profiles=${pack.profiles.length}; synthetic-geometry=true; automatic-test-authorization=false; public-road-approved=false`);
