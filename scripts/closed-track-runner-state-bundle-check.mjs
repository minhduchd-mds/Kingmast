import {existsSync, readFileSync} from 'node:fs';

const argv = process.argv.slice(2);
const jsonMode = argv.includes('--json');

function valueAfter(flag, fallback) {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value after ${flag}`);
  return value;
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/[\r\n\t]/.test(value);
}

const path = valueAfter('--bundle', 'docs/validation/closed-track/V006_CLOSED_TRACK_RUNNER_STATE_BUNDLE_TEMPLATE.json');
const expected = valueAfter('--source-commit', process.env.GITHUB_SHA ?? null);
if (!existsSync(path)) throw new Error(`Controlled-track runner state bundle not found: ${path}`);
const bundle = JSON.parse(readFileSync(path, 'utf8'));

const failures = [];
const expect = (label, condition) => { if (!condition) failures.push(label); };
const allowedStates = new Set(['blocked', 'ready', 'captured-awaiting-review', 'reviewed-pass', 'reviewed-fail']);
const canonical = Array.from({length: 8}, (_, index) => `CT-${String(index + 1).padStart(3, '0')}`);
const states = Array.isArray(bundle.scenarioStates) ? bundle.scenarioStates : [];

expect('schema', bundle.schema === 'kingmast-closed-track-runner-state-bundle/v1');
expect('version', bundle.version === '0.0.6');
expect('authority', bundle.controlAuthority === 'none');
expect('no qualification', bundle.automaticQualification === false && bundle.closedTrackApproved === false && bundle.targetHardwareQualified === false && bundle.publicRoadApproved === false);
expect('no registry automation', bundle.registryMutationByAutomation === false);
expect('no CAN TX', bundle.canTxPathPresent === false);
expect('8 scenarios', states.length === 8);
expect('canonical ids', JSON.stringify(states.map((item) => item.id).sort()) === JSON.stringify([...canonical].sort()));

const prerequisiteEntries = Object.entries(bundle.prerequisites ?? {});
expect('10 entry prerequisites', prerequisiteEntries.length === 10);
for (const [key, value] of prerequisiteEntries) {
  expect(`${key} prerequisite object`, value && typeof value === 'object' && !Array.isArray(value));
  expect(`${key} prerequisite status`, ['pending', 'reviewed'].includes(value?.status));
  if (value?.status === 'reviewed') {
    expect(`${key} evidence ref`, nonEmpty(value?.evidenceRef));
    expect(`${key} evidence sha`, isSha256(value?.sha256));
  }
}
const allPrerequisitesReviewed = prerequisiteEntries.length === 10 && prerequisiteEntries.every(([, value]) => value?.status === 'reviewed');

const templateMode = bundle.status === 'template-only-no-physical-state';
if (templateMode) {
  expect('template source null', bundle.sourceSoftwareCommit === null);
  expect('template physical false', bundle.physicalClosedTrackExecuted === false);
  expect('template all blocked', states.every((item) => item.state === 'blocked'));
  expect('template prerequisites pending', prerequisiteEntries.every(([, value]) => value?.status === 'pending'));
}

if (bundle.sourceSoftwareCommit !== null) expect('source commit', isCommit(bundle.sourceSoftwareCommit));
if (expected && bundle.sourceSoftwareCommit !== null) expect('source match', bundle.sourceSoftwareCommit.toLowerCase() === expected.toLowerCase());
if (bundle.runner?.runnerIdentitySha256 !== null) expect('runner identity sha', isSha256(bundle.runner.runnerIdentitySha256));

for (const scenario of states) {
  expect(`${scenario.id} state`, allowedStates.has(scenario.state));
  expect(`${scenario.id} blockers`, Array.isArray(scenario.blockers));

  if (scenario.state === 'blocked') {
    expect(`${scenario.id} blocker present`, scenario.blockers.length > 0);
  } else {
    expect(`${scenario.id} source frozen`, isCommit(bundle.sourceSoftwareCommit));
    expect(`${scenario.id} runner identity`, isSha256(bundle.runner?.runnerIdentitySha256));
    expect(`${scenario.id} blockers clear`, scenario.blockers.length === 0);
    expect(`${scenario.id} entry prerequisites reviewed`, allPrerequisitesReviewed);
    expect(`${scenario.id} facility id`, nonEmpty(bundle.runner?.facilityId));
    expect(`${scenario.id} emergency procedure`, nonEmpty(bundle.runner?.emergencyProcedureRef));
  }

  if (['captured-awaiting-review', 'reviewed-pass', 'reviewed-fail'].includes(scenario.state)) {
    expect(`${scenario.id} capture ref`, nonEmpty(scenario.capturePackageRef));
    expect(`${scenario.id} capture sha`, isSha256(scenario.capturePackageSha256));
    expect(`${scenario.id} operator`, nonEmpty(scenario.operator));
    expect(`${scenario.id} independent observer`, nonEmpty(scenario.independentObserver) && scenario.independentObserver !== scenario.operator);
  }

  if (['reviewed-pass', 'reviewed-fail'].includes(scenario.state)) {
    expect(`${scenario.id} reviewer`, nonEmpty(scenario.independentReviewer) && scenario.independentReviewer !== scenario.operator && scenario.independentReviewer !== scenario.independentObserver);
    expect(`${scenario.id} review ref`, nonEmpty(scenario.reviewRef));
    expect(`${scenario.id} review sha`, isSha256(scenario.reviewSha256));
  }
}

const counts = {
  blocked: states.filter((item) => item.state === 'blocked').length,
  ready: states.filter((item) => item.state === 'ready').length,
  'captured-awaiting-review': states.filter((item) => item.state === 'captured-awaiting-review').length,
  'reviewed-pass': states.filter((item) => item.state === 'reviewed-pass').length,
  'reviewed-fail': states.filter((item) => item.state === 'reviewed-fail').length
};

const report = {
  schema: 'kingmast-closed-track-runner-state-validation/v1',
  version: bundle.version,
  controlAuthority: 'none',
  templateMode,
  counts,
  entryPrerequisitesReviewed: allPrerequisitesReviewed,
  physicalClosedTrackExecuted: bundle.physicalClosedTrackExecuted === true,
  automaticQualification: false,
  registryMutationByAutomation: false,
  closedTrackApproved: false,
  targetHardwareQualified: false,
  publicRoadApproved: false,
  failures
};

if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else console.log(`KINGMAST controlled-track runner state: blocked ${counts.blocked}, ready ${counts.ready}, captured ${counts['captured-awaiting-review']}, reviewed-pass ${counts['reviewed-pass']}, reviewed-fail ${counts['reviewed-fail']}.`);
if (failures.length) process.exit(1);
