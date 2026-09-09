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

function load(path, label) {
  if (!existsSync(path)) throw new Error(`${label} not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

const runner = load(
  valueAfter('--runner-state', 'docs/validation/closed-track/V006_CLOSED_TRACK_RUNNER_STATE_BUNDLE_TEMPLATE.json'),
  'controlled-track runner state'
);
const registry = load(
  valueAfter('--registry', 'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json'),
  'controlled-track registry'
);
const index = load(
  valueAfter('--ingestion-index', 'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_INGESTION_INDEX.json'),
  'controlled-track ingestion index'
);

const failures = [];
const expect = (label, condition) => { if (!condition) failures.push(label); };

expect('runner schema', runner.schema === 'kingmast-closed-track-runner-state-bundle/v1');
expect('registry schema', registry.schema === 'kingmast-closed-track-evidence-registry/v1');
expect('index schema', index.schema === 'kingmast-closed-track-evidence-ingestion-index/v1');
expect('authority boundary', runner.controlAuthority === 'none' && registry.controlAuthority === 'none' && index.controlAuthority === 'none');
expect('automatic registry mutation disabled', runner.registryMutationByAutomation === false && index.automaticRegistryMutation === false);
expect('qualification false', runner.targetHardwareQualified === false && registry.targetHardwareQualified === false && index.targetHardwareQualified === false);
expect('closed-track approval false', runner.closedTrackApproved === false && registry.closedTrackApproved === false && index.closedTrackApproved === false);
expect('public-road approval false', runner.publicRoadApproved === false && registry.publicRoadApproved === false && index.publicRoadApproved === false);

const ids = Array.from({length: 8}, (_, indexValue) => `CT-${String(indexValue + 1).padStart(3, '0')}`);
const runnerMap = new Map((runner.scenarioStates ?? []).map((item) => [item.id, item]));
const registryMap = new Map((registry.scenarios ?? []).map((item) => [item.id, item]));
const records = Array.isArray(index.records) ? index.records : [];

expect('runner scenario count', runnerMap.size === 8);
expect('registry scenario count', registryMap.size >= 8);

const packageDigests = new Set();
for (const record of records) {
  expect(`record scenario ${String(record?.scenarioId)}`, ids.includes(record?.scenarioId));
  expect(`record package sha ${String(record?.scenarioId)}`, isSha256(record?.packageSha256));
  expect(`record package unique ${String(record?.packageSha256)}`, !packageDigests.has(record?.packageSha256));
  packageDigests.add(record?.packageSha256);
}

const latest = (id) => [...records].reverse().find((item) => item?.scenarioId === id) ?? null;

const scenarios = ids.map((id) => {
  const runnerState = runnerMap.get(id);
  const registryState = registryMap.get(id);
  const ingestion = latest(id);

  let status = 'BLOCKED';
  let detail = 'physical Gate-3 prerequisites pending';

  if (registryState?.status === 'reviewed-pass') {
    status = 'REVIEWED';
    detail = 'independent registry pass';
  } else if (registryState?.status === 'reviewed-fail') {
    status = 'FAILED';
    detail = 'independent registry fail';
  } else if (ingestion) {
    status = 'CAPTURED';
    detail = 'validated controlled-track package awaiting independent review';
  } else if (runnerState?.state === 'ready') {
    status = 'READY';
    detail = 'bounded controlled-track entry prerequisites reviewed';
  } else if (runnerState?.state === 'captured-awaiting-review') {
    status = 'CAPTURED';
    detail = 'runner reports captured package awaiting review';
  }

  return {
    id,
    status,
    detail,
    blockers: Array.isArray(runnerState?.blockers) ? runnerState.blockers : [],
    registryStatus: registryState?.status ?? null,
    ingestionPackageSha256: ingestion?.packageSha256 ?? null
  };
});

const count = (status) => scenarios.filter((item) => item.status === status).length;
const counts = {
  BLOCKED: count('BLOCKED'),
  READY: count('READY'),
  CAPTURED: count('CAPTURED'),
  REVIEWED: count('REVIEWED'),
  FAILED: count('FAILED')
};

const report = {
  schema: 'kingmast-closed-track-coverage-dashboard/v1',
  version: '0.0.6',
  controlAuthority: 'none',
  qualificationClaim: 'controlled-track-lifecycle-dashboard-not-physical-qualification',
  scenarioCount: 8,
  counts,
  executionReadinessPercent: Math.round((counts.READY / 8) * 1000) / 10,
  captureCoveragePercent: Math.round(((counts.CAPTURED + counts.REVIEWED + counts.FAILED) / 8) * 1000) / 10,
  reviewedEvidenceCoveragePercent: Math.round(((counts.REVIEWED + counts.FAILED) / 8) * 1000) / 10,
  automaticRegistryMutation: false,
  closedTrackApproved: false,
  targetHardwareQualified: false,
  publicRoadApproved: false,
  scenarios,
  failures
};

if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else console.log(`KINGMAST controlled-track coverage: BLOCKED ${counts.BLOCKED}, READY ${counts.READY}, CAPTURED ${counts.CAPTURED}, REVIEWED ${counts.REVIEWED}, FAILED ${counts.FAILED}; reviewed evidence ${report.reviewedEvidenceCoveragePercent}%.`);
if (failures.length) process.exit(1);
