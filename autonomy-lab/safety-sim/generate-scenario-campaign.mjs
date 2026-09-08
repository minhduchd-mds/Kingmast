import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
const profiles=[
{id:'nominal-day',lighting:'day',weather:'clear',traffic:'nominal',roadModifier:'none'},
{id:'night',lighting:'night',weather:'clear',traffic:'nominal',roadModifier:'none'},
{id:'dusk-glare',lighting:'dusk-glare',weather:'clear',traffic:'nominal',roadModifier:'exposure-transition'},
{id:'heavy-rain',lighting:'day',weather:'heavy-rain',traffic:'nominal',roadModifier:'wet'},
{id:'spray',lighting:'day',weather:'spray',traffic:'dense',roadModifier:'wet'},
{id:'fog',lighting:'day',weather:'fog',traffic:'nominal',roadModifier:'reduced-visibility'},
{id:'wet-road',lighting:'day',weather:'rain',traffic:'nominal',roadModifier:'low-contrast'},
{id:'construction',lighting:'day',weather:'clear',traffic:'dense',roadModifier:'temporary-lane-shift'},
{id:'weak-marking',lighting:'day',weather:'clear',traffic:'nominal',roadModifier:'faded-markings'},
{id:'urban-dense',lighting:'day',weather:'clear',traffic:'dense-urban',roadModifier:'occlusion'},
{id:'highway-dense',lighting:'day',weather:'clear',traffic:'dense-highway',roadModifier:'cut-in'},
{id:'tunnel-entry',lighting:'exposure-transition',weather:'clear',traffic:'nominal',roadModifier:'tunnel-entry'},
{id:'tunnel-exit',lighting:'exposure-transition',weather:'clear',traffic:'nominal',roadModifier:'tunnel-exit'},
{id:'occlusion-heavy',lighting:'day',weather:'clear',traffic:'dense',roadModifier:'large-vehicle-occlusion'},
{id:'vn-motorcycle-dense',lighting:'day',weather:'clear',traffic:'vn-motorcycle-dense',roadModifier:'mixed-traffic'},
{id:'low-light-vru',lighting:'low-light',weather:'clear',traffic:'urban',roadModifier:'vru-low-contrast'}
];
const cases=[];
for(const scenario of library.scenarios??[]){for(const profile of profiles){cases.push({id:`${scenario.id}::${profile.id}`,baseScenarioId:scenario.id,domain:scenario.domain,regions:scenario.regions,sourceRefs:scenario.sourceRefs,profile,oracleKind:scenario.oracle?.kind,baselineExpected:scenario.expected,executionStatus:'planned',externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,publicRoadApproved:false});}}
const domainCount=new Set(cases.map((item)=>item.domain)).size;
const regionSet=new Set(cases.flatMap((item)=>item.regions??[]));
const campaignSha256=createHash('sha256').update(cases.map((item)=>item.id).join('\n')).digest('hex');
const report={schema:'kingmast-safety-scenario-campaign/v1',generatedAt:new Date().toISOString(),productVersion:library.version,controlAuthority:'none',qualificationClaim:'scenario-campaign-generation-only-not-simulator-or-physical-evidence',automaticProductionPromotion:false,productionThresholdMutation:false,externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,baseScenarioCount:(library.scenarios??[]).length,profileCount:profiles.length,campaignCaseCount:cases.length,domainCount,regions:[...regionSet].sort(),campaignSha256,profiles,cases,limitation:'Campaign cases expand planned environmental and traffic coverage. They are not executed simulator, HIL, closed-track or public-road evidence until external run artifacts are attached and reviewed.'};
const args=new Set(process.argv.slice(2));
if(args.has('--json'))console.log(JSON.stringify(report,null,2));else console.log(`[scenario-campaign] base=${report.baseScenarioCount}; profiles=${report.profileCount}; planned-cases=${report.campaignCaseCount}; domains=${report.domainCount}; executed=false`);
if(args.has('--ci')){const required=['heavy-rain','fog','night','dusk-glare','construction','weak-marking','vn-motorcycle-dense','low-light-vru'];const ids=new Set(profiles.map((item)=>item.id));const good=report.baseScenarioCount>=35&&report.profileCount>=16&&report.campaignCaseCount>=500&&report.domainCount>=15&&['US','EU','VN','OEM'].every((region)=>regionSet.has(region))&&required.every((id)=>ids.has(id))&&/^[a-f0-9]{64}$/.test(campaignSha256);if(!good)process.exit(1);}
