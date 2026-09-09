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
expect('VERSION matches matrix',version===matrix.productVersion);
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
expect('firmware trust evidence exists',existsSync(matrix.compatibility?.firmwareTrustEvidence??''));
expect('A/B recovery evidence exists',existsSync(matrix.compatibility?.abRecoveryModel??''));
expect('hardware qualification matrix exists',existsSync(matrix.compatibility?.hardwareQualificationMatrix??''));
expect('sensor calibration lifecycle exists',existsSync(matrix.compatibility?.sensorCalibrationLifecycle??''));
expect('qualification readiness dashboard exists',existsSync(matrix.compatibility?.qualificationReadinessDashboard??''));
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
for(const required of ['target vehicle-computer identity and OS image','firmware revision and signed-manifest evidence','configuration revision','sensor calibration revision','long-duration resource soak','fault injection and degraded-mode evidence','controlled closed-track test record','review approval with no public-road authorization implied'])expect(`Gate-3 requirement: ${required}`,gate3.has(required));

if(failures.length){
  console.error(`KINGMAST release qualification policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`KINGMAST release qualification matrix passed for v${version}: ${matrix.displayClasses.length} CI display classes, ${matrix.vehicleComputerTargets.length} target classes, no target-hardware/public-road qualification claim.`);
