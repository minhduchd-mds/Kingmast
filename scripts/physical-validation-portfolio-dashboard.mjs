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

function lifecycleSummary(ids, runner, registry, ingestionIndex, kind) {
  const failures = [];
  const runnerMap = new Map((runner.scenarioStates ?? []).map((item) => [item.id, item]));
  const registryMap = new Map((registry.scenarios ?? []).map((item) => [item.id, item]));
  const records = Array.isArray(ingestionIndex.records) ? ingestionIndex.records : [];

  if (runnerMap.size !== ids.length) failures.push(`${kind}: runner scenario count`);
  if (registryMap.size < ids.length) failures.push(`${kind}: registry scenario count`);

  const seen = new Set();
  for (const record of records) {
    if (!ids.includes(record?.scenarioId)) failures.push(`${kind}: unknown ingestion scenario ${String(record?.scenarioId)}`);
    if (!isSha256(record?.packageSha256)) failures.push(`${kind}: invalid ingestion package digest`);
    if (seen.has(record?.packageSha256)) failures.push(`${kind}: duplicate ingestion package digest`);
    seen.add(record?.packageSha256);
  }

  const latest = (id) => [...records].reverse().find((item) => item?.scenarioId === id) ?? null;
  const scenarios = ids.map((id) => {
    const runnerState = runnerMap.get(id);
    const registryState = registryMap.get(id);
    const ingestion = latest(id);
    let status = 'BLOCKED';

    if (registryState?.status === 'reviewed-pass') status = 'REVIEWED';
    else if (registryState?.status === 'reviewed-fail') status = 'FAILED';
    else if (ingestion || runnerState?.state === 'captured-awaiting-review') status = 'CAPTURED';
    else if (runnerState?.state === 'ready') status = 'READY';

    return {id, status};
  });

  const count = (status) => scenarios.filter((item) => item.status === status).length;
  const counts = {
    BLOCKED: count('BLOCKED'),
    READY: count('READY'),
    CAPTURED: count('CAPTURED'),
    REVIEWED: count('REVIEWED'),
    FAILED: count('FAILED')
  };
  const reviewed = counts.REVIEWED + counts.FAILED;

  return {
    total: ids.length,
    counts,
    reviewed,
    reviewedEvidenceCoveragePercent: Math.round((reviewed / ids.length) * 1000) / 10,
    scenarios,
    failures
  };
}

const hilRunner = load(valueAfter('--hil-runner', 'docs/validation/hil/V006_HIL_RUNNER_STATE_BUNDLE_TEMPLATE.json'), 'HIL runner state');
const hilRegistry = load(valueAfter('--hil-registry', 'docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json'), 'HIL registry');
const hilIndex = load(valueAfter('--hil-index', 'docs/validation/hil/V006_HIL_EVIDENCE_INGESTION_INDEX.json'), 'HIL ingestion index');

const ctRunner = load(valueAfter('--ct-runner', 'docs/validation/closed-track/V006_CLOSED_TRACK_RUNNER_STATE_BUNDLE_TEMPLATE.json'), 'controlled-track runner state');
const ctRegistry = load(valueAfter('--ct-registry', 'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json'), 'controlled-track registry');
const ctIndex = load(valueAfter('--ct-index', 'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_INGESTION_INDEX.json'), 'controlled-track ingestion index');

const storePolicy = load(valueAfter('--store-policy', 'docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_POLICY.json'), 'physical evidence store policy');
const storeIndex = load(valueAfter('--store-index', 'docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_INDEX.json'), 'physical evidence store index');
const reviewQueue = load(valueAfter('--review-queue', 'docs/review/V006_PHYSICAL_EVIDENCE_REVIEW_QUEUE.json'), 'physical evidence review queue');
const programReview = load(valueAfter('--program-review', 'docs/review/V006_INDEPENDENT_REVIEW_REGISTRY.json'), 'program independent review registry');

const failures = [];
const expect = (label, condition) => { if (!condition) failures.push(label); };

expect('HIL runner schema', hilRunner.schema === 'kingmast-hil-runner-state-bundle/v1');
expect('HIL registry schema', hilRegistry.schema === 'kingmast-hil-evidence-registry/v1');
expect('HIL index schema', hilIndex.schema === 'kingmast-hil-evidence-ingestion-index/v1');
expect('controlled-track runner schema', ctRunner.schema === 'kingmast-closed-track-runner-state-bundle/v1');
expect('controlled-track registry schema', ctRegistry.schema === 'kingmast-closed-track-evidence-registry/v1');
expect('controlled-track index schema', ctIndex.schema === 'kingmast-closed-track-evidence-ingestion-index/v1');
expect('store policy schema', storePolicy.schema === 'kingmast-physical-evidence-store-policy/v1');
expect('store index schema', storeIndex.schema === 'kingmast-physical-evidence-store-index/v1');
expect('review queue schema', reviewQueue.schema === 'kingmast-physical-evidence-review-queue/v1');
expect('program review schema', programReview.schema === 'kingmast-independent-review-registry/v1');

for (const [label, document] of Object.entries({
  hilRunner,
  hilIndex,
  ctRunner,
  ctRegistry,
  ctIndex,
  storePolicy,
  storeIndex,
  reviewQueue,
  programReview
})) {
  expect(`${label} control authority`, document.controlAuthority === 'none');
  expect(`${label} target qualification false`, document.targetHardwareQualified !== true);
  expect(`${label} public-road approval false`, document.publicRoadApproved !== true);
}
expect('controlled-track approval false', ctRunner.closedTrackApproved === false && ctRegistry.closedTrackApproved === false && ctIndex.closedTrackApproved === false && storePolicy.closedTrackApproved === false && storeIndex.closedTrackApproved === false && reviewQueue.closedTrackApproved === false && programReview.closedTrackApproved === false);
expect('automation cannot mutate registries', hilIndex.automaticRegistryMutation === false && ctIndex.automaticRegistryMutation === false && storePolicy.automaticRegistryMutation === false && storeIndex.automaticRegistryMutation === false && reviewQueue.automaticRegistryMutation === false);

const hilIds = Array.from({length: 12}, (_, index) => `HIL-${String(index + 1).padStart(3, '0')}`);
const ctIds = Array.from({length: 8}, (_, index) => `CT-${String(index + 1).padStart(3, '0')}`);
const hil = lifecycleSummary(hilIds, hilRunner, hilRegistry, hilIndex, 'hil');
const closedTrack = lifecycleSummary(ctIds, ctRunner, ctRegistry, ctIndex, 'closed-track');
failures.push(...hil.failures, ...closedTrack.failures);

const reviewItems = Array.isArray(reviewQueue.items) ? reviewQueue.items : [];
const reviewQueueCounts = {
  pending: reviewItems.filter((item) => item.state === 'pending-assignment').length,
  assigned: reviewItems.filter((item) => item.state === 'assigned').length,
  inReview: reviewItems.filter((item) => item.state === 'in-review').length,
  completed: reviewItems.filter((item) => item.state === 'completed').length
};

const programReviews = Array.isArray(programReview.reviews) ? programReview.reviews : [];
const programReviewCompleteCount = programReviews.filter((item) => item.status === 'complete').length;
const programReviewHasOpenFindings = programReviews.some((item) => Array.isArray(item.findings) && item.findings.some((finding) => finding.status === 'open'));
const programReviewComplete = programReview.overallStatus === 'reviewed' && programReviewCompleteCount === programReviews.length && !programReviewHasOpenFindings;

const physicalScenarioTotal = hil.total + closedTrack.total;
const reviewedScenarioCount = hil.reviewed + closedTrack.reviewed;
const reviewedPhysicalScenarioCoveragePercent = Math.round((reviewedScenarioCount / physicalScenarioTotal) * 1000) / 10;

const storeRecordCount = Array.isArray(storeIndex.records) ? storeIndex.records.length : 0;
const protectedStoreReady = storeIndex.backendConfigured === true && storePolicy.backendConfigured === true && storeRecordCount >= reviewedScenarioCount;

const gate3PhysicalEvidenceReady =
  failures.length === 0 &&
  reviewedScenarioCount === physicalScenarioTotal &&
  protectedStoreReady &&
  reviewQueueCounts.pending === 0 &&
  reviewQueueCounts.assigned === 0 &&
  reviewQueueCounts.inReview === 0 &&
  programReviewComplete;

const report = {
  schema: 'kingmast-physical-validation-portfolio-dashboard/v1',
  version: '0.0.6',
  controlAuthority: 'none',
  qualificationClaim: 'physical-validation-lifecycle-portfolio-not-homologation-or-public-road-approval',
  hil,
  closedTrack,
  evidenceStore: {
    backendConfigured: storeIndex.backendConfigured === true,
    recordCount: storeRecordCount,
    protectedStoreReady
  },
  independentReviewQueue: {
    itemCount: reviewItems.length,
    counts: reviewQueueCounts
  },
  programIndependentReview: {
    overallStatus: programReview.overallStatus,
    domainCount: programReviews.length,
    completeCount: programReviewCompleteCount,
    openFindingsPresent: programReviewHasOpenFindings,
    complete: programReviewComplete
  },
  physicalScenarioTotal,
  reviewedScenarioCount,
  reviewedPhysicalScenarioCoveragePercent,
  gate3PhysicalEvidenceReady,
  automaticQualification: false,
  automaticRegistryMutation: false,
  targetHardwareQualified: false,
  closedTrackApproved: false,
  publicRoadApproved: false,
  failures
};

if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else console.log(`KINGMAST physical validation portfolio: HIL reviewed ${hil.reviewed}/${hil.total}; controlled-track reviewed ${closedTrack.reviewed}/${closedTrack.total}; protected-store records ${storeRecordCount}; program review ${programReview.overallStatus}; Gate-3 physical evidence ready=${gate3PhysicalEvidenceReady}.`);
if (failures.length) process.exit(1);
