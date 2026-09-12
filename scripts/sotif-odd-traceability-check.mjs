import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(`SOTIF ODD/TRACEABILITY POLICY FAIL: ${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };

const sources = json('docs/safety/sotif/V008_SOURCE_REGISTER.json');
const scenarios = json('docs/safety/sotif/V008_TRIGGERING_CONDITION_REGISTRY.json');
const domain = json('docs/safety/sotif/V008_RESEARCH_OPERATING_DOMAIN.json');
const hara = read('docs/safety/HARA_DRAFT_V006.md');
const assurance = read('services/risk-engine/src/sotif-assurance.ts');
const assuranceTests = read('services/risk-engine/src/sotif-assurance.test.ts');
const bridge = read('autonomy-lab/adapters/export-sotif-openx-bridge.mjs');

expect(domain.schema === 'kingmast-sotif-research-operating-domain/v1', 'research operating-domain schema mismatch');
expect(domain.productVersion === '0.0.8', 'research operating-domain profile must remain bound to v0.0.8');
expect(domain.controlAuthority === 'none', 'research operating-domain profile must preserve zero actuator authority');
expect(domain.qualificationClaim === 'research-operating-domain-model-only-not-validated-odd-or-compliance', 'research operating-domain profile must reject validation/compliance claim');
expect(domain.systemBoundary?.automationLevel === 'SAE-Level-0-warning-only', 'operating-domain profile must preserve Level-0 warning-only boundary');
expect(domain.systemBoundary?.vehicleActuation === false && domain.systemBoundary?.automaticBraking === false && domain.systemBoundary?.automaticSteering === false, 'operating-domain profile may not create vehicle-control authority');
expect(domain.referenceModel?.asamOpenOdd?.targetVersion === '1.0.0', 'ASAM OpenODD target version must be explicit');
expect(domain.referenceModel?.asamOpenScenarioXml?.targetVersion === '1.4.0', 'ASAM OpenSCENARIO XML target version must be explicit');
expect(domain.referenceModel?.asamOpenOdd?.mappingStatus.includes('not-schema-validated'), 'OpenODD mapping must not imply schema validation');
expect(domain.referenceModel?.asamOpenScenarioXml?.mappingStatus.includes('not-schema-validated'), 'OpenSCENARIO mapping must not imply schema validation');

const physical = domain.physicalValidation ?? {};
expect(physical.status === 'pending', 'physical validation must remain pending');
for (const flag of ['targetHardwareQualified', 'hilQualified', 'controlledTrackQualified', 'publicRoadApproved']) {
  expect(physical[flag] === false, `${flag} must remain false without physical evidence`);
}
for (const bound of [
  'validatedSpeedRangeKmh',
  'validatedRadarRangeM',
  'validatedCameraDetectionRangeM',
  'validatedVisibilityRangeM',
  'validatedPrecipitationRangeMmH',
  'validatedIlluminationRangeLux',
  'validatedTemperatureRangeC',
  'maxValidatedGnssAccuracyM',
  'maxValidatedCrossSensorSkewMs',
]) {
  expect(physical[bound] === null, `${bound} must remain null until physically evidenced`);
}
expect(domain.operatingConditions?.environment?.weatherMustBeObserved === true, 'weather must be observation-backed');
expect(domain.operatingConditions?.environment?.fabricatedWeatherForbidden === true, 'fabricated weather must remain forbidden');
expect(domain.operatingConditions?.sensorAndDataConditions?.crossSensorDisagreementMayNotIncreaseConfidence === true, 'sensor disagreement must not increase confidence');
expect(domain.operatingConditions?.sensorAndDataConditions?.cameraOnlyDepthMayNotBecomeAuthoritativeCollisionRange === true, 'camera-only depth must not become authoritative collision range');

const sourceIds = new Set(sources.sources.map((source) => source.id));
for (const ref of [domain.referenceModel.iso34503.sourceRef, domain.referenceModel.asamOpenOdd.sourceRef, domain.referenceModel.asamOpenScenarioXml.sourceRef]) {
  expect(sourceIds.has(ref), `operating-domain profile references unknown source ${ref}`);
}

const hazardIds = new Set(hara.match(/HZ-\d{3}/g) ?? []);
for (const scenario of scenarios.scenarios) {
  expect(Array.isArray(scenario.hazards) && scenario.hazards.length > 0, `${scenario.id} lacks hazard traceability`);
  for (const hazard of scenario.hazards) expect(hazardIds.has(hazard), `${scenario.id} references unknown hazard ${hazard}`);
  for (const sourceRef of scenario.sourceRefs) expect(sourceIds.has(sourceRef), `${scenario.id} references unknown source ${sourceRef}`);
  expect(scenario.controlAuthority === 'none', `${scenario.id} creates prohibited control authority`);
  expect(scenario.evidenceState === 'software-only-pending-physical', `${scenario.id} overstates evidence maturity`);
}

const traceReport = JSON.parse(execFileSync(process.execPath, ['scripts/sotif-traceability-report.mjs'], {
  cwd: root,
  encoding: 'utf8',
}));
expect(traceReport.schema === 'kingmast-sotif-test-traceability-report/v1', 'traceability report schema mismatch');
expect(traceReport.productVersion === '0.0.8', 'traceability report must remain bound to v0.0.8');
expect(traceReport.scenarioCount === scenarios.scenarios.length, 'every SOTIF scenario must appear in traceability report');
expect(traceReport.candidateMappedCount === scenarios.scenarios.length, 'every SOTIF scenario must have existing candidate automated evidence files');
expect(traceReport.physicalEvidenceCompleteCount === 0, 'software policy must not invent completed physical evidence');
expect(traceReport.controlAuthority === 'none', 'traceability report must preserve zero actuator authority');
expect(traceReport.qualificationClaim === 'traceability-planning-report-only-not-sotif-conformity-or-physical-validation', 'traceability report must reject SOTIF/conformity claims');
expect(traceReport.cases.every((item) => item.physicalEvidenceState === 'pending' && item.targetHardwareQualified === false && item.hilQualified === false && item.controlAuthority === 'none'), 'scenario traceability must preserve pending physical evidence and no-actuation boundary');

expect(assurance.includes("qualificationClaim: 'research-runtime-diagnostics-only-not-sotif-conformity'"), 'runtime assurance snapshot must reject conformity claim');
expect(assurance.includes("controlAuthority: 'none'"), 'runtime assurance snapshot must preserve zero actuator authority');
expect(assurance.includes('targetHardwareQualified: false') && assurance.includes('controlledTrackQualified: false') && assurance.includes('publicRoadApproved: false'), 'runtime assurance must not invent physical qualification');
expect(assuranceTests.includes('does not invent a validated physical envelope by default'), 'runtime assurance no-invented-envelope regression test missing');
expect(assuranceTests.includes('front radar is unavailable'), 'runtime assurance radar-loss regression test missing');

expect(bridge.includes("openOdd: '1.0.0'") && bridge.includes("openScenarioXml: '1.4.0'"), 'OpenX bridge target versions missing');
expect(bridge.includes('openOddSchemaValidated: false') && bridge.includes('openScenarioXmlSchemaValidated: false') && bridge.includes('asamConformant: false'), 'OpenX bridge must not claim unperformed ASAM schema validation/conformance');
expect(bridge.includes('physicalHilExecuted: false') && bridge.includes('controlledTrackExecuted: false') && bridge.includes('publicRoadApproved: false'), 'OpenX bridge must preserve physical-evidence boundaries');
expect(bridge.includes("controlAuthority: 'none'"), 'OpenX bridge must preserve warning-only authority');

for (const required of [
  'scripts/sotif-traceability-report.mjs',
  'scripts/sotif-odd-traceability-check.mjs',
  'autonomy-lab/adapters/export-sotif-openx-bridge.mjs',
  'services/risk-engine/src/sotif-assurance.ts',
  'services/risk-engine/src/sotif-assurance.test.ts',
]) {
  expect(existsSync(resolve(root, required)), `${required} is required`);
}

console.log(`KINGMAST SOTIF ODD/traceability policy passed: ${scenarios.scenarios.length} scenarios mapped, physical bounds remain unclaimed, OpenODD 1.0.0/OpenSCENARIO XML 1.4.0 are bridge targets only.`);
