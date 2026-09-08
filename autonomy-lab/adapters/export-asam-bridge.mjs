import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
const args=process.argv.slice(2);
const json=args.includes('--json');
const all=args.includes('--all');
const requested=args.find((arg)=>!arg.startsWith('--'))??null;

const roadTemplateByDomain={
  'forward-collision':'straight-multilane','vru':'urban-crossing','motorcycle':'multilane','sensor-limitations':'generic-road','sensor-integrity':'bench-no-road','lane-departure':'multilane','dms':'highway','speed-context':'urban-or-highway','rear-cross-traffic':'parking-aisle','blind-spot':'multilane','surround':'parking-area','provider-trust':'connected-road','update-integrity':'bench-no-road','warning-arbitration':'generic-road','vn-road-context':'urban-vietnam-synthetic'
};

function actorsFor(scenario){
  const cls=scenario.oracle?.objectClass;
  const actors=[{id:'ego',role:'ego',type:'vehicle'}];
  if(cls)actors.push({id:'actor-1',role:'conflict-actor',type:cls});
  if(scenario.domain==='blind-spot')actors.push({id:'adjacent-vehicle',role:'blind-zone-actor',type:'vehicle'});
  if(scenario.domain==='rear-cross-traffic')actors.push({id:'cross-traffic',role:'crossing-actor',type:'vehicle'});
  return actors;
}

function bridge(scenario){
  return{
    schema:'kingmast-asam-simulation-bridge-manifest/v1',
    scenarioId:scenario.id,
    title:scenario.title,
    sourceRegions:scenario.regions,
    sourceRefs:scenario.sourceRefs,
    controlAuthority:'none',
    qualificationClaim:'simulation-bridge-draft-only-not-asam-conformance-or-physical-validation',
    targetFormats:{openDrive:{version:'1.9.0',scope:'static-road-network'},openScenarioXml:{version:'1.4.0',scope:'dynamic-scenario'}},
    conformance:{schemaValidated:false,asamConformant:false,carlaExecuted:false,esminiExecuted:false},
    roadModel:{template:roadTemplateByDomain[scenario.domain]??'generic-road',syntheticOnly:true,noRealWorldCoordinates:true},
    actors:actorsFor(scenario),
    environment:scenario.environment,
    dynamicIntent:{domain:scenario.domain,oracleKind:scenario.oracle?.kind??null,expectedDecision:scenario.expected?.decision??null,expectedReason:scenario.expected?.reason??null},
    exportRules:{preserveSourceTraceability:true,preserveWarningOnlyBoundary:true,allowActuatorAuthority:false,requireHumanReviewBeforeExternalExecution:true},
    limitations:[
      'This manifest is an adapter contract, not an ASAM schema-valid XOSC/XODR document.',
      'External simulator execution must validate generated files against the selected simulator and ASAM schemas.',
      'Simulation execution does not satisfy HIL, target-hardware, controlled-track or public-road evidence requirements.'
    ]
  };
}

const selected=all?(library.scenarios??[]):(requested?(library.scenarios??[]).filter((item)=>item.id===requested):[(library.scenarios??[])[0]].filter(Boolean));
if(requested&&!selected.length)throw new Error(`unknown scenario id: ${requested}`);
const manifests=selected.map(bridge);
const report={schema:'kingmast-asam-simulation-bridge-report/v1',generatedAt:new Date().toISOString(),productVersion:library.version,controlAuthority:'none',qualificationClaim:'simulation-bridge-draft-only-not-asam-conformance-or-physical-validation',scenarioCount:manifests.length,targetVersions:{openDrive:'1.9.0',openScenarioXml:'1.4.0'},asamSchemaValidated:false,carlaExecuted:false,esminiExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,publicRoadApproved:false,manifests};

if(json)console.log(JSON.stringify(report,null,2));
else console.log(`[asam-bridge] scenarios=${report.scenarioCount}; OpenDRIVE=${report.targetVersions.openDrive}; OpenSCENARIO=${report.targetVersions.openScenarioXml}; schema-validated=false; physical-validation=false`);
