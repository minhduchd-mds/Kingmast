import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluateIndependentOracle,round} from './oracle.mjs';

const root=process.cwd();
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
if(library.schema!=='kingmast-independent-safety-scenario-library/v1')throw new Error('unexpected scenario library schema');
if(library.controlAuthority!=='none')throw new Error('independent scenario library must preserve controlAuthority=none');
const results=[];
for(const scenario of library.scenarios??[]){const actual=evaluateIndependentOracle(scenario.oracle??{});const passed=actual.decision===scenario.expected?.decision&&actual.reason===scenario.expected?.reason;results.push({id:scenario.id,domain:scenario.domain,regions:scenario.regions,passed,expected:scenario.expected,actual});}
const failed=results.filter((item)=>!item.passed);
const decisionCounts=results.reduce((acc,item)=>{acc[item.actual.decision]=(acc[item.actual.decision]??0)+1;return acc;},{});
const regions=[...new Set(results.flatMap((item)=>item.regions??[]))].sort();
const domains=[...new Set(results.map((item)=>item.domain))].sort();
const degradationCases=results.filter((item)=>['degrade','reject'].includes(item.expected?.decision));
const degradationPassed=degradationCases.filter((item)=>item.passed).length;
const vruClasses=new Set();
for(const scenario of library.scenarios??[]){const cls=scenario.oracle?.objectClass;if(['pedestrian','cyclist','motorcycle'].includes(cls))vruClasses.add(cls);}
const dmsCount=(library.scenarios??[]).filter((item)=>item.domain==='dms').length;
const requiredRegionSet=new Set(['US','EU','VN','OEM']);
const regionCoverage=[...requiredRegionSet].filter((region)=>regions.includes(region)).length/requiredRegionSet.size;
const passRate=results.length?results.filter((item)=>item.passed).length/results.length:0;
const degradationRate=degradationCases.length?degradationPassed/degradationCases.length:0;
const vruCoverage=Math.min(1,vruClasses.size/3);
const humanFactorsCoverage=Math.min(1,dmsCount/3);
const boundaryCoverage=library.controlAuthority==='none'&&library.oraclePolicy?.changesProductionThresholds===false&&library.oraclePolicy?.onlineLearning===false?1:0;
const recognitionResearchScore=round(100*(0.5*passRate+0.15*degradationRate+0.15*regionCoverage+0.1*vruCoverage+0.05*humanFactorsCoverage+0.05*boundaryCoverage),1);
let coverageBand='exploratory';if(recognitionResearchScore>=90)coverageBand='broad-simulation-coverage';else if(recognitionResearchScore>=75)coverageBand='strong-simulation-coverage';else if(recognitionResearchScore>=60)coverageBand='baseline-simulation-coverage';else if(recognitionResearchScore>=40)coverageBand='partial-simulation-coverage';
const report={schema:'kingmast-independent-safety-simulation-report/v1',generatedAt:new Date().toISOString(),productVersion:library.version,controlAuthority:'none',qualificationClaim:'independent-simulation-research-only-not-real-world-safety-rating',importsProductionRiskCode:false,onlineLearning:false,productionThresholdMutation:false,physicalVehicleTest:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,total:results.length,passed:results.length-failed.length,failed:failed.length,allPassed:failed.length===0,decisions:decisionCounts,regions,domains,researchMetrics:{passRate:round(passRate),degradationIntegrityRate:round(degradationRate),regionCoverageRate:round(regionCoverage),vulnerableRoadUserClassCoverage:[...vruClasses].sort(),driverMonitoringScenarioCount:dmsCount,recognitionResearchScore,coverageBand},cases:results,limitations:['The research score measures deterministic scenario coverage and oracle consistency, not real-world safety, ASIL, type approval, homologation, Euro NCAP rating or legal compliance.','The independent oracle intentionally does not import KINGMAST production risk code, so matching results cannot be caused by sharing the same implementation.','Research thresholds are local simulation parameters. They must never be promoted automatically into a vehicle build.','Physical target, HIL, proving-ground and independent-review evidence remain separate requirements.']};
const args=new Set(process.argv.slice(2));if(args.has('--json'))console.log(JSON.stringify(report,null,2));else console.log(`[independent-safety-sim] ${report.passed}/${report.total} scenarios passed; score=${recognitionResearchScore}/100 ${coverageBand}; regions=${regions.join(',')}; production-qualification=false`);
if(args.has('--ci')){if(report.total<35||!report.allPassed||regionCoverage<1||degradationRate<1||vruCoverage<1||humanFactorsCoverage<1||boundaryCoverage!==1)process.exit(1);}
