import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const registryPath=resolve(root,'autonomy-lab/safety-research/source-registry.json');
const scenariosPath=resolve(root,'autonomy-lab/safety-sim/scenario-library.json');
const simulatorDir=resolve(root,'autonomy-lab/safety-sim');
const researchDir=resolve(root,'autonomy-lab/safety-research');
const registry=JSON.parse(readFileSync(registryPath,'utf8'));
const library=JSON.parse(readFileSync(scenariosPath,'utf8'));
const simulator=readFileSync(resolve(simulatorDir,'run-independent-safety-sim.mjs'),'utf8');
const simulatorPrograms=readdirSync(simulatorDir).filter((name)=>name.endsWith('.mjs')).map((name)=>({name,text:readFileSync(resolve(simulatorDir,name),'utf8')}));
const researchPrograms=readdirSync(researchDir).filter((name)=>name.endsWith('.mjs')&&name!=='validate-safety-research.mjs').map((name)=>({name,text:readFileSync(resolve(researchDir,name),'utf8')}));
const failures=[];

function fail(message){failures.push(message);}
function expect(condition,message){if(!condition)fail(message);}
function boundedText(value,max=1200){return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000]/.test(value);}
function httpsUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}

expect(registry.schema==='kingmast-independent-safety-source-registry/v1','unexpected source registry schema');
expect(registry.version==='0.0.6','source registry version must remain 0.0.6');
expect(registry.controlAuthority==='none','source registry controlAuthority must remain none');
expect(registry.qualificationClaim==='research-source-registry-only-not-compliance-or-homologation','source registry must preserve research-only qualification claim');
expect(registry.copyPolicy==='metadata-and-original-paraphrase-only','source registry must preserve clean-room copy policy');
expect(registry.promotionPolicy?.automaticProductionPromotion===false,'research sources must never auto-promote to production');
expect(registry.promotionPolicy?.automaticSafetyThresholdMutation===false,'research sources must never mutate production safety thresholds');
expect(registry.promotionPolicy?.humanReviewRequired===true,'research promotion must require human review');
expect(registry.promotionPolicy?.realWorldEvidenceRequired===true,'research promotion must require real-world evidence');

const sources=Array.isArray(registry.sources)?registry.sources:[];
expect(sources.length>=16,'at least 16 diverse public sources are required');
const sourceIds=new Set();
const sourceRegions=new Set();
const sourceTypes=new Set();
for(const source of sources){
  expect(boundedText(source.id,96),`invalid source id ${String(source.id)}`);
  if(sourceIds.has(source.id))fail(`duplicate source id ${source.id}`); else sourceIds.add(source.id);
  sourceRegions.add(source.region);
  sourceTypes.add(source.sourceType);
  expect(['US','EU','VN','OEM','International'].includes(source.region),`${source.id}: unsupported region`);
  expect(httpsUrl(source.url),`${source.id}: source URL must be HTTPS without embedded credentials`);
  expect(boundedText(source.authority,160),`${source.id}: authority is required`);
  expect(boundedText(source.title,240),`${source.id}: title is required`);
  expect(['high','medium'].includes(source.confidence),`${source.id}: source confidence must be high or medium`);
  expect(Array.isArray(source.topics)&&source.topics.length>=1&&source.topics.length<=12,`${source.id}: topics must contain 1..12 entries`);
  expect(Array.isArray(source.scenarioTags)&&source.scenarioTags.length>=1&&source.scenarioTags.length<=12,`${source.id}: scenarioTags must contain 1..12 entries`);
  expect(Array.isArray(source.principles)&&source.principles.length>=1&&source.principles.length<=4,`${source.id}: principles must contain 1..4 original paraphrases`);
  for(const principle of source.principles??[]){
    expect(boundedText(principle,520),`${source.id}: principle text must be bounded`);
    if(/\b(certified|homologated|road-approved|ASIL [A-D])\b/i.test(principle))fail(`${source.id}: source principle must not create a KINGMAST compliance claim`);
  }
}
for(const region of ['US','EU','VN','OEM','International'])expect(sourceRegions.has(region),`source registry is missing ${region} research`);
for(const type of ['regulator-guidance','regulation','law','technical-regulation','standard-abstract','open-standard','oem-product-reference'])expect(sourceTypes.has(type),`source registry is missing sourceType ${type}`);

expect(library.schema==='kingmast-independent-safety-scenario-library/v1','unexpected scenario library schema');
expect(library.version==='0.0.6','scenario library version must remain 0.0.6');
expect(library.controlAuthority==='none','scenario library controlAuthority must remain none');
expect(library.qualificationClaim==='independent-simulation-research-only-not-real-world-safety-rating','scenario library must preserve simulation-only claim');
expect(library.oraclePolicy?.importsProductionRiskCode===false,'independent oracle must not import production risk code');
expect(library.oraclePolicy?.changesProductionThresholds===false,'independent oracle must not change production thresholds');
expect(library.oraclePolicy?.onlineLearning===false,'online learning is prohibited from changing the safety oracle');
expect(library.oraclePolicy?.humanReviewRequiredForPromotion===true,'human review is required before any research promotion');

const scenarios=Array.isArray(library.scenarios)?library.scenarios:[];
expect(scenarios.length>=35,'independent safety library must contain at least 35 scenarios');
const scenarioIds=new Set();
const scenarioRegions=new Set();
const domains=new Set();
const referencedSources=new Set();
for(const scenario of scenarios){
  expect(boundedText(scenario.id,96),`invalid scenario id ${String(scenario.id)}`);
  if(scenarioIds.has(scenario.id))fail(`duplicate scenario id ${scenario.id}`); else scenarioIds.add(scenario.id);
  expect(boundedText(scenario.title,240),`${scenario.id}: title is required`);
  expect(boundedText(scenario.domain,96),`${scenario.id}: domain is required`);
  domains.add(scenario.domain);
  expect(Array.isArray(scenario.regions)&&scenario.regions.length>=1,`${scenario.id}: at least one region is required`);
  for(const region of scenario.regions??[]){scenarioRegions.add(region);expect(['US','EU','VN','OEM','International'].includes(region),`${scenario.id}: unsupported scenario region ${region}`);}
  expect(Array.isArray(scenario.sourceRefs)&&scenario.sourceRefs.length>=1&&scenario.sourceRefs.length<=8,`${scenario.id}: sourceRefs must contain 1..8 entries`);
  for(const ref of scenario.sourceRefs??[]){referencedSources.add(ref);expect(sourceIds.has(ref),`${scenario.id}: unknown sourceRef ${ref}`);}
  expect(scenario.oracle&&typeof scenario.oracle==='object'&&!Array.isArray(scenario.oracle),`${scenario.id}: oracle object is required`);
  expect(boundedText(scenario.oracle?.kind,96),`${scenario.id}: oracle.kind is required`);
  expect(['warn','degrade','reject','monitor','safe'].includes(scenario.expected?.decision),`${scenario.id}: unsupported expected decision`);
  expect(boundedText(scenario.expected?.reason,160),`${scenario.id}: expected reason is required`);
}
for(const region of ['US','EU','VN','OEM'])expect(scenarioRegions.has(region),`scenario library is missing ${region} coverage`);
for(const domain of ['forward-collision','vru','motorcycle','lane-departure','dms','speed-context','sensor-limitations','sensor-integrity','rear-cross-traffic','blind-spot','surround','provider-trust','update-integrity','warning-arbitration','vn-road-context'])expect(domains.has(domain),`scenario library is missing domain ${domain}`);
for(const id of sources.filter((source)=>source.region==='International').map((source)=>source.id))expect(referencedSources.has(id),`international research source ${id} must ground at least one scenario`);

const forbiddenProductionRefs=['services/risk-engine','packages/contracts','apps/hmi','edge/esp32','edge/camera-detector'];
for(const program of [...simulatorPrograms,...researchPrograms]){
  for(const ref of forbiddenProductionRefs)expect(!program.text.includes(ref),`${program.name}: independent research program must not reference production path ${ref}`);
  expect(!/\bfetch\s*\(/.test(program.text),`${program.name}: deterministic research programs must not perform network fetches`);
  expect(!/\bhttps?:\/\//.test(program.text),`${program.name}: deterministic research programs must not embed remote runtime dependencies`);
  expect(!/\bchild_process\b/.test(program.text),`${program.name}: deterministic research programs must not shell out to external processes`);
}
expect(simulator.includes("qualificationClaim:'independent-simulation-research-only-not-real-world-safety-rating'"),'simulator must emit the research-only qualification claim');
expect(simulator.includes("controlAuthority:'none'"),'simulator must preserve controlAuthority=none');
expect(simulator.includes('productionThresholdMutation:false'),'simulator must report productionThresholdMutation=false');
expect(simulator.includes('publicRoadApproved:false'),'simulator must report publicRoadApproved=false');
const sweep=simulatorPrograms.find((program)=>program.name==='run-parameter-sweep.mjs')?.text??'';
expect(sweep.includes("qualificationClaim:'parameter-exploration-research-only-not-real-world-safety-rating'"),'parameter sweep must preserve research-only claim');
expect(sweep.includes('productionThresholdMutation:false'),'parameter sweep must preserve productionThresholdMutation=false');

if(failures.length){console.error('KINGMAST independent safety research validation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[independent-safety-research] sources=${sources.length}; scenarios=${scenarios.length}; regions=${[...sourceRegions].sort().join(',')}; independent-oracle=true; auto-production-promotion=false`);
