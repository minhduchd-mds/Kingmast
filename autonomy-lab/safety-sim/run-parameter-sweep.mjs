import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluateIndependentOracle,round} from './oracle.mjs';

const root=process.cwd();
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
const FACTORS=[0.8,0.9,1,1.1,1.2];
const NUMERIC_KEYS=['egoSpeedMps','objectSpeedMps','rangeM','visibility','egoDistanceToConflictM','actorSpeedMps','actorDistanceToConflictM','ageMs','clockSkewMs','laneConfidence','timeToBoundaryS','kss','gazeAwayRatio','temporalSpanS','confidence','egoSpeedKph','mapLimitKph','signLimitKph','signConfidence','lateralAbsM','longitudinalM','closingSpeedMps','cameraCount','calibratedCount','synchronizedCount','occludedCount','maxReprojectionErrorPx','maxFrameSkewMs','maxAgeMs'];

function clone(value){return JSON.parse(JSON.stringify(value));}
function scaleOracle(oracle,factor){
  const copy=clone(oracle);
  for(const key of NUMERIC_KEYS){
    if(typeof copy[key]!=='number')continue;
    if(['cameraCount','calibratedCount','synchronizedCount','occludedCount','kss'].includes(key))copy[key]=Math.max(0,Math.round(copy[key]*factor));
    else copy[key]=round(copy[key]*factor,4);
  }
  return copy;
}
function firstNumericKey(oracle){return NUMERIC_KEYS.find((key)=>typeof oracle?.[key]==='number')??null;}

const variants=[];
const exceptions=[];
for(const scenario of library.scenarios??[]){
  for(const factor of FACTORS){
    const oracle=scaleOracle(scenario.oracle??{},factor);
    try{
      const actual=evaluateIndependentOracle(oracle);
      variants.push({id:`${scenario.id}@${factor.toFixed(1)}`,scenarioId:scenario.id,domain:scenario.domain,kind:oracle.kind,factor,actual,baselineExpected:scenario.expected,decisionChanged:actual.decision!==scenario.expected?.decision||actual.reason!==scenario.expected?.reason});
    }catch(error){exceptions.push({scenarioId:scenario.id,factor,error:String(error)});}
  }
}

for(const scenario of (library.scenarios??[]).slice(0,10)){
  const key=firstNumericKey(scenario.oracle);
  if(!key)continue;
  const oracle=clone(scenario.oracle);
  oracle[key]=round(oracle[key]*1.5,4);
  try{
    const actual=evaluateIndependentOracle(oracle);
    variants.push({id:`${scenario.id}@boundary-${key}`,scenarioId:scenario.id,domain:scenario.domain,kind:oracle.kind,factor:1.5,boundaryKey:key,actual,baselineExpected:scenario.expected,decisionChanged:actual.decision!==scenario.expected?.decision||actual.reason!==scenario.expected?.reason});
  }catch(error){exceptions.push({scenarioId:scenario.id,boundaryKey:key,error:String(error)});}
}

const distribution=variants.reduce((acc,item)=>{acc[item.actual.decision]=(acc[item.actual.decision]??0)+1;return acc;},{});
const changed=variants.filter((item)=>item.decisionChanged);
const domains=[...new Set(variants.map((item)=>item.domain))].sort();
const report={
  schema:'kingmast-independent-safety-parameter-sweep/v1',
  generatedAt:new Date().toISOString(),
  productVersion:library.version,
  controlAuthority:'none',
  qualificationClaim:'parameter-exploration-research-only-not-real-world-safety-rating',
  importsProductionRiskCode:false,
  onlineLearning:false,
  productionThresholdMutation:false,
  physicalVehicleTest:false,
  physicalHilExecuted:false,
  closedTrackExecuted:false,
  targetHardwareQualified:false,
  publicRoadApproved:false,
  scenarioCount:(library.scenarios??[]).length,
  variantCount:variants.length,
  exceptionCount:exceptions.length,
  decisionDistribution:distribution,
  decisionChangeCount:changed.length,
  domainCount:domains.length,
  domains,
  changedDecisionCandidates:changed.slice(0,40).map((item)=>({id:item.id,scenarioId:item.scenarioId,baseline:item.baselineExpected,actual:item.actual})),
  limitations:[
    'Parameter sweeps are exploratory boundary probes only and do not establish production thresholds.',
    'A decision change is a research candidate, not a failure and not an instruction to modify vehicle behavior.',
    'Any production threshold proposal requires separate human engineering review and SIL/HIL/target/track evidence.'
  ]
};

const args=new Set(process.argv.slice(2));
if(args.has('--json'))console.log(JSON.stringify(report,null,2));
else console.log(`[independent-safety-sweep] variants=${report.variantCount}; exceptions=${report.exceptionCount}; changed=${report.decisionChangeCount}; domains=${report.domainCount}; production-threshold-mutation=false`);

if(args.has('--ci')){
  if(report.scenarioCount<35||report.variantCount<185||report.exceptionCount!==0||report.domainCount<15)process.exit(1);
}
