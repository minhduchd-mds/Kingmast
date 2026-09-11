import {existsSync,readFileSync} from 'node:fs';

const matrixPath='docs/validation/V006_RELEASE_QUALIFICATION_MATRIX.json';
const matrix=JSON.parse(readFileSync(matrixPath,'utf8'));
const root=JSON.parse(readFileSync('package.json','utf8'));
const hmi=JSON.parse(readFileSync('apps/hmi/package.json','utf8'));
const risk=JSON.parse(readFileSync('services/risk-engine/package.json','utf8'));
const contracts=JSON.parse(readFileSync('packages/contracts/package.json','utf8'));
const version=readFileSync('VERSION','utf8').trim();
const failures=[];

function expect(name,condition){if(!condition)failures.push(name);}
function dependencyMatches(actual,expected){return actual===expected;}

expect('matrix schema',matrix.schema==='kingmast-release-qualification-matrix/v1');
expect('warning-only control authority',matrix.controlAuthority==='none');
expect('matrix does not claim target-hardware qualification',matrix.targetHardwareQualified===false);
expect('matrix does not claim physical vehicle-computer qualification',matrix.physicalVehicleComputerQualified===false);
expect('matrix does not claim closed-track approval',matrix.closedTrackApproved===false);
expect('matrix does not claim public-road approval',matrix.publicRoadApproved===false);
expect('development qualification claim is explicit',matrix.qualificationClaim==='development-compatibility-matrix-not-target-hardware-qualification');
expect('historical qualification matrix keeps an explicit product version',typeof matrix.productVersion==='string'&&matrix.productVersion.length>0);
expect('historical qualification matrix is not silently promoted to current release',matrix.productVersion!==version);
expect('historical matrix compatibility version remains self-consistent',matrix.compatibility?.productVersion===matrix.productVersion);
expect('root package version matches VERSION',root.version===version);
expect('HMI package version matches VERSION',hmi.version===version);
expect('risk engine package version matches VERSION',risk.version===version);
expect('contracts package version matches VERSION',contracts.version===version);
expect('pnpm toolchain is pinned',root.packageManager===`pnpm@${matrix.toolchain?.pnpm}`);
expect('Node major is the CI major',matrix.toolchain?.nodeMajor===22);
expect('HMI Next version matches package',dependencyMatches(hmi.dependencies?.next,matrix.toolchain?.hmi?.next));
expect('HMI React version matches package',dependencyMatches(hmi.dependencies?.react,matrix.toolchain?.hmi?.react));
expect('HMI TypeScript version matches package',dependencyMatches(hmi.devDependencies?.typescript,matrix.toolchain?.hmi?.typescript));
expect('risk Fastify version matches package',dependencyMatches(risk.dependencies?.fastify,matrix.toolchain?.riskEngine?.fastify));
expect('risk Zod version matches package',dependencyMatches(risk.dependencies?.zod,matrix.toolchain?.riskEngine?.zod));
expect('risk TypeScript version matches package',dependencyMatches(risk.devDependencies?.typescript,matrix.toolchain?.riskEngine?.typescript));
expect('edge protocol remains v1',matrix.compatibility?.edgeProtocolVersion===1);
expect('rollback evidence is required',matrix.compatibility?.rollbackEvidenceRequired===true);

for(const [label,path] of [
  ['firmware trust evidence',matrix.compatibility?.firmwareTrustEvidence],
  ['A/B recovery model',matrix.compatibility?.abRecoveryModel],
  ['hardware qualification matrix',matrix.compatibility?.hardwareQualificationMatrix],
  ['sensor calibration lifecycle',matrix.compatibility?.sensorCalibrationLifecycle],
  ['qualification readiness dashboard',matrix.compatibility?.qualificationReadinessDashboard],
  ['physical bench execution pack',matrix.compatibility?.physicalBenchExecutionPack],
  ['physical bench runbook',matrix.compatibility?.physicalBenchRunbook],
  ['vehicle harness mapping',matrix.compatibility?.vehicleHarnessMapping],
  ['physical device provisioning',matrix.compatibility?.physicalDeviceProvisioning],
  ['physical calibration capture',matrix.compatibility?.physicalCalibrationCapture],
  ['HIL bench matrix',matrix.compatibility?.hilBenchMatrix],
  ['HIL equipment capability matrix',matrix.compatibility?.hilEquipmentCapabilityMatrix],
  ['HIL time synchronization contract',matrix.compatibility?.hilTimeSyncContract],
  ['HIL scenario evidence requirements',matrix.compatibility?.hilScenarioEvidenceRequirements],
  ['HIL orchestration runbook',matrix.compatibility?.hilOrchestrationRunbook],
  ['HIL runner state bundle',matrix.compatibility?.hilRunnerStateBundle],
  ['HIL evidence ingestion index',matrix.compatibility?.hilEvidenceIngestionIndex],
  ['HIL coverage dashboard',matrix.compatibility?.hilCoverageDashboard],
  ['physical evidence store policy',matrix.compatibility?.physicalEvidenceStorePolicy],
  ['physical evidence store index',matrix.compatibility?.physicalEvidenceStoreIndex],
  ['physical evidence review queue',matrix.compatibility?.physicalEvidenceReviewQueue],
  ['physical evidence review package',matrix.compatibility?.physicalEvidenceReviewPackage],
  ['closed-track runner state bundle',matrix.compatibility?.closedTrackRunnerStateBundle],
  ['closed-track evidence ingestion index',matrix.compatibility?.closedTrackEvidenceIngestionIndex],
  ['closed-track coverage dashboard',matrix.compatibility?.closedTrackCoverageDashboard],
  ['physical validation portfolio dashboard',matrix.compatibility?.physicalValidationPortfolioDashboard]
])expect(`${label} exists`,existsSync(path??''));

expect('configuration revision is required for target hardware',String(matrix.compatibility?.configurationRevisionPolicy??'').includes('explicit external revision required'));
expect('calibration revision is required for target hardware',String(matrix.compatibility?.calibrationRevisionPolicy??'').includes('explicit external revision required'));
expect('display classes are defined',Array.isArray(matrix.displayClasses)&&matrix.displayClasses.length>=3);
for(const display of matrix.displayClasses??[]){
  expect(`display ${display.id} has dimensions`,Number.isInteger(display.width)&&display.width>=800&&Number.isInteger(display.height)&&display.height>=400);
  expect(`display ${display.id} is CI-only evidence`,display.status==='ci-ui-regression-covered');
  for(const evidence of display.evidence??[])expect(`display ${display.id} evidence exists: ${evidence}`,existsSync(evidence));
}
expect('vehicle-computer targets are explicit',Array.isArray(matrix.vehicleComputerTargets)&&matrix.vehicleComputerTargets.length>=3);
for(const target of matrix.vehicleComputerTargets??[])expect(`target ${target.id} still requires physical evidence`,target.targetHardwareEvidenceRequired===true);

const gate3=new Set(matrix.gate3RequiredEvidence??[]);
for(const required of [
  'target vehicle-computer identity and OS image',
  'firmware revision and signed-manifest evidence',
  'configuration revision',
  'sensor calibration revision',
  'physical bench and harness review',
  'device provisioning identity and source-commit binding',
  'physical sensor calibration capture and independent review',
  'reviewed HIL equipment capability assignment',
  'reviewed cross-device time synchronization evidence',
  'scenario-by-scenario HIL preflight and evidence completeness report',
  'protected physical evidence store registration with package and evidence digests',
  'independent per-package review disposition before registry promotion',
  'HIL and controlled-track lifecycle coverage report',
  'long-duration resource soak',
  'fault injection and degraded-mode evidence',
  'controlled closed-track test record',
  'review approval with no public-road authorization implied'
])expect(`Gate-3 requirement: ${required}`,gate3.has(required));

if(failures.length){
  console.error(`KINGMAST release qualification policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`KINGMAST current package set v${version} is internally consistent; historical V006 qualification matrix remains bound to v${matrix.productVersion} with ${matrix.displayClasses.length} CI display classes, ${matrix.vehicleComputerTargets.length} target classes, protected evidence store/review lifecycle contracts present, and no target-hardware/public-road qualification claim.`);
