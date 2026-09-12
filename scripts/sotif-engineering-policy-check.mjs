import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const fail = (message) => { throw new Error(`SOTIF POLICY FAIL: ${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };

const sourceRegister = json('docs/safety/sotif/V008_SOURCE_REGISTER.json');
const scenarioRegister = json('docs/safety/sotif/V008_TRIGGERING_CONDITION_REGISTRY.json');
const currentReplay = json('docs/validation/replays/V008_RISK_REPLAY.json');
const historicalReplay = json('docs/validation/replays/V006_RISK_REPLAY.json');
const engineering = read('docs/safety/SOTIF_ENGINEERING_V008.md');
const hara = read('docs/safety/HARA_DRAFT_V006.md');
const monitor = read('services/risk-engine/src/sotif-monitor.ts');
const monitorTests = read('services/risk-engine/src/sotif-monitor.test.ts');
const fusion = read('services/risk-engine/src/edge-fusion.ts');
const fusionTests = read('services/risk-engine/src/edge-fusion.test.ts');
const risk = read('services/risk-engine/src/risk.ts');
const riskTests = read('services/risk-engine/src/risk.test.ts');
const alerts = read('services/risk-engine/src/object-alerts.ts');
const alertTests = read('services/risk-engine/src/object-alerts.test.ts');
const replayTests = read('services/risk-engine/src/sil-replay.test.ts');
const replayCli = read('services/risk-engine/src/sil-replay-cli.ts');

expect(sourceRegister.schema === 'kingmast-sotif-source-register/v1', 'source-register schema mismatch');
expect(sourceRegister.productVersion === '0.0.8', 'source register must remain bound to v0.0.8');
expect(sourceRegister.controlAuthority === 'none', 'source register must preserve no-actuation authority');
expect(sourceRegister.qualificationClaim === 'research-reference-register-only-not-compliance', 'source register must explicitly reject compliance claim');
expect(Array.isArray(sourceRegister.sources) && sourceRegister.sources.length >= 10, 'at least ten authoritative references are required');

const allowedHosts = new Set([
  'www.iso.org',
  'www.asam.net',
  'publications.pages.asam.net',
  'www.euroncap.com',
  'cdn.euroncap.com',
  'www.nhtsa.gov',
]);
const sourceIds = new Set();
for (const source of sourceRegister.sources) {
  expect(typeof source.id === 'string' && source.id.length > 3, 'source id is required');
  expect(!sourceIds.has(source.id), `duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  const url = new URL(source.url);
  expect(url.protocol === 'https:', `${source.id} must use HTTPS`);
  expect(allowedHosts.has(url.hostname), `${source.id} uses non-authoritative/unapproved host ${url.hostname}`);
  expect(typeof source.status === 'string' && typeof source.role === 'string', `${source.id} metadata incomplete`);
}
for (const required of ['ISO-21448-2022', 'ISO-26262-FAMILY', 'ISO-34502-2022', 'ISO-34503-2023', 'ISO-34504-2024', 'ISO-34505-2025', 'ASAM-OPENSCENARIO-XML', 'ASAM-OPENODD-1.0.0', 'EURONCAP-AEB-C2C-4.3.1', 'NHTSA-FMVSS-127']) {
  expect(sourceIds.has(required), `missing required authoritative source ${required}`);
}

expect(scenarioRegister.schema === 'kingmast-sotif-scenario-registry/v1', 'scenario-register schema mismatch');
expect(scenarioRegister.productVersion === '0.0.8', 'scenario register must remain bound to v0.0.8');
expect(scenarioRegister.controlAuthority === 'none', 'scenario registry must preserve no-actuation authority');
expect(scenarioRegister.qualificationClaim === 'research-scenario-registry-only-not-sotif-conformity', 'scenario registry must reject SOTIF conformity claim');
expect(Array.isArray(scenarioRegister.scenarios) && scenarioRegister.scenarios.length >= 32, 'at least 32 traceable SOTIF scenarios are required');

const hazardIds = new Set(hara.match(/HZ-\d{3}/g) ?? []);
expect(hazardIds.size >= 12, 'HARA hazard register is unexpectedly incomplete');

const scenarioIds = new Set();
const categories = new Set();
const classes = new Set();
const titleCorpus = [];
for (const scenario of scenarioRegister.scenarios) {
  expect(/^S8-\d{3}$/.test(scenario.id), `invalid scenario id ${scenario.id}`);
  expect(!scenarioIds.has(scenario.id), `duplicate scenario id ${scenario.id}`);
  scenarioIds.add(scenario.id);
  categories.add(scenario.category);
  classes.add(scenario.class);
  titleCorpus.push(`${scenario.title} ${scenario.trigger}`.toLowerCase());
  expect(['nominal', 'boundary', 'triggering-condition', 'degradation', 'misuse'].includes(scenario.class), `${scenario.id} invalid scenario class`);
  expect(Array.isArray(scenario.inputs) && scenario.inputs.length >= 1, `${scenario.id} inputs missing`);
  expect(typeof scenario.expected === 'string' && scenario.expected.length >= 20, `${scenario.id} expected behavior too weak`);
  expect(Array.isArray(scenario.forbiddenClaims) && scenario.forbiddenClaims.length >= 1, `${scenario.id} forbidden claims missing`);
  expect(Array.isArray(scenario.hazards) && scenario.hazards.length >= 1, `${scenario.id} hazard traceability missing`);
  for (const hazard of scenario.hazards) expect(hazardIds.has(hazard), `${scenario.id} references unknown HARA hazard ${hazard}`);
  expect(Array.isArray(scenario.sourceRefs) && scenario.sourceRefs.length >= 1, `${scenario.id} source references missing`);
  for (const ref of scenario.sourceRefs) expect(sourceIds.has(ref), `${scenario.id} references unknown source ${ref}`);
  expect(scenario.evidenceState === 'software-only-pending-physical', `${scenario.id} must not claim physical evidence`);
  expect(scenario.controlAuthority === 'none', `${scenario.id} creates prohibited control authority`);
}

for (const requiredClass of ['nominal', 'boundary', 'triggering-condition', 'degradation', 'misuse']) {
  expect(classes.has(requiredClass), `scenario class coverage missing ${requiredClass}`);
}
for (const requiredCategory of [
  'longitudinal-lead-vehicle',
  'cut-in-cut-out',
  'curvature-association',
  'vulnerable-road-user',
  'environment',
  'sensor-limitation',
  'sensor-disagreement',
  'association-ambiguity',
  'temporal-integrity',
  'positioning-limitation',
  'foreseeable-misuse',
  'operating-envelope',
  'calibration-lifecycle',
]) {
  expect(categories.has(requiredCategory), `scenario category coverage missing ${requiredCategory}`);
}

const corpus = titleCorpus.join('\n');
for (const token of [
  'stationary lead',
  'slower moving lead',
  'braking lead',
  'motorcycle cut-in',
  'curve',
  'occluded pedestrian',
  'night',
  'heavy rain',
  'fog',
  'glare',
  'camera lens obstructed',
  'radar ghost',
  'timestamp skew',
  'stale observation',
  'future-dated',
  'frozen live telemetry',
  'gnss multipath',
  'level-0 warning system',
]) {
  expect(corpus.includes(token), `triggering-condition coverage missing ${token}`);
}

expect(engineering.includes('camera-only estimated depth as authoritative collision range'), 'engineering plan must explicitly prohibit camera-only authoritative collision range');
expect(engineering.includes('no invented physical envelope'), 'engineering plan must explicitly prohibit invented validation envelopes');
expect(engineering.includes('L4 HIL') && engineering.includes('L5 controlled track') && engineering.includes('L6 independent review'), 'engineering plan must preserve physical validation layers');

expect(monitor.includes("controlAuthority: 'none'"), 'runtime SOTIF monitor must remain warning-only');
expect(monitor.includes("qualificationClaim: 'research-runtime-monitor-only'"), 'runtime monitor must reject qualification claim');
expect(monitor.includes('validatedSpeedRangeKmh: null'), 'default SOTIF monitor must not invent a validated speed range');
expect(monitor.includes('maxGnssAccuracyM: null'), 'default SOTIF monitor must not invent a validated GNSS accuracy bound');
expect(monitor.includes('cross-sensor-disagreement'), 'runtime monitor must represent sensor disagreement');
expect(monitor.includes('camera-obstructed-observed'), 'runtime monitor must represent observed camera obstruction');
expect(monitorTests.includes('heavy rain and glare') && monitorTests.includes('cross-sensor disagreement'), 'SOTIF triggering-condition tests are incomplete');

expect(fusion.includes('usedCameraIds.has(detection.id)'), 'fusion must enforce one-to-one camera association');
expect(fusion.includes('MAX_FUTURE_SKEW_MS'), 'fusion must reject excessive future timestamps');
expect(fusion.includes("severity: 'safe'") && fusion.includes("source: 'camera-only'"), 'camera-only estimated depth must stay spatial-only');
expect(fusionTests.includes('never reuses one camera detection') && fusionTests.includes('future-dated radar frames'), 'fusion insufficiency tests are incomplete');

expect(risk.includes('critical-blocked-can-degraded'), 'FCW must record critical suppression when vehicle speed evidence is degraded');
expect(risk.includes('criticalClosingGap && sample.canHealthy'), 'critical FCW must require trustworthy vehicle dynamics');
expect(riskTests.includes('does not create a caution solely because CAN is degraded'), 'CAN degradation regression test missing');
expect(riskTests.includes('Short headway') || riskTests.includes('short headway'), 'headway boundary test missing');

expect(alerts.includes("object.source === 'camera-only'"), 'camera-only depth must be excluded from textual collision alerts');
expect(alertTests.includes('camera-only estimated depth'), 'camera-only alert suppression test missing');

expect(Array.isArray(currentReplay) && currentReplay.length >= 10, 'current V008 SIL replay corpus must contain at least ten deterministic cases');
expect(currentReplay.some((item) => item.scenarioId === 'SIL8-RISK-008' && item.expected?.reasonsInclude?.includes('critical-blocked-can-degraded')), 'current replay must cover CAN-degraded critical suppression');
expect(currentReplay.some((item) => item.scenarioId === 'SIL8-RISK-009' && item.expected?.reasonsInclude?.includes('camera-degraded')), 'current replay must cover camera degradation');
expect(Array.isArray(historicalReplay) && historicalReplay.some((item) => item.scenarioId === 'SIL-RISK-006' && item.expected?.confidenceMax === 0.49), 'historical V006 replay evidence must remain immutable rather than being silently rewritten');
expect(replayTests.includes('V008_RISK_REPLAY.json') && replayTests.includes('historical V006 replay corpus'), 'SIL replay tests must separate current behavior from historical evidence');
expect(replayCli.includes('V008_RISK_REPLAY.json') && replayCli.includes("productVersion:'0.0.8'"), 'SIL replay CLI must emit the current v0.0.8 corpus identity');

console.log(`KINGMAST SOTIF engineering policy passed: ${scenarioRegister.scenarios.length} scenarios, ${sourceRegister.sources.length} authoritative references, ${currentReplay.length} current SIL replay cases, no physical/conformity claim.`);
