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

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function iso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function bounded(value, max = 512) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\r\n\t]/.test(value);
}

const path = valueAfter('--queue', 'docs/review/V006_PHYSICAL_EVIDENCE_REVIEW_QUEUE.json');
if (!existsSync(path)) throw new Error(`Physical evidence review queue not found: ${path}`);
const queue = JSON.parse(readFileSync(path, 'utf8'));

const failures = [];
const expect = (label, condition) => { if (!condition) failures.push(label); };

expect('schema', queue.schema === 'kingmast-physical-evidence-review-queue/v1');
expect('version', queue.version === '0.0.6');
expect('controlAuthority', queue.controlAuthority === 'none');
expect('automatic assignment disabled', queue.automaticAssignment === false);
expect('automatic review disabled', queue.automaticReview === false);
expect('automatic registry mutation disabled', queue.automaticRegistryMutation === false);
expect('targetHardwareQualified false', queue.targetHardwareQualified === false);
expect('closedTrackApproved false', queue.closedTrackApproved === false);
expect('publicRoadApproved false', queue.publicRoadApproved === false);
expect('items array', Array.isArray(queue.items));

const allowedEvidenceClasses = new Set(queue.policy?.allowedEvidenceClasses ?? []);
const allowedStates = new Set(['pending-assignment', 'assigned', 'in-review', 'completed']);
const itemIds = new Set();
const packageDigests = new Set();

for (const item of queue.items ?? []) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    failures.push('review item must be object');
    continue;
  }
  if (!/^RQ-[A-Z0-9-]{4,80}$/.test(item.id ?? '') || itemIds.has(item.id)) failures.push(`invalid or duplicate queue item id ${String(item.id)}`);
  itemIds.add(item.id);

  if (!allowedEvidenceClasses.has(item.evidenceClass)) failures.push(`${item.id}: evidenceClass`);
  if (item.evidenceClass === 'hil' && !/^HIL-\d{3}$/.test(item.scenarioId ?? '')) failures.push(`${item.id}: HIL scenarioId`);
  if (item.evidenceClass === 'closed-track' && !/^CT-\d{3}$/.test(item.scenarioId ?? '')) failures.push(`${item.id}: controlled-track scenarioId`);
  if (!isCommit(item.sourceSoftwareCommit)) failures.push(`${item.id}: sourceSoftwareCommit`);
  if (!isSha256(item.capturePackageSha256) || packageDigests.has(item.capturePackageSha256)) failures.push(`${item.id}: duplicate or invalid capturePackageSha256`);
  packageDigests.add(item.capturePackageSha256);
  if (!bounded(item.operator, 200)) failures.push(`${item.id}: operator`);
  if (!allowedStates.has(item.state)) failures.push(`${item.id}: state`);

  if (item.state === 'pending-assignment') {
    if (item.independentReviewer !== null) failures.push(`${item.id}: pending item must not have reviewer`);
    if (item.assignedAt !== null || item.reviewedAt !== null || item.reviewPackageSha256 !== null || item.reviewDisposition !== null) failures.push(`${item.id}: pending item contains review completion metadata`);
  }

  if (['assigned', 'in-review', 'completed'].includes(item.state)) {
    if (!bounded(item.independentReviewer, 200) || item.independentReviewer === item.operator) failures.push(`${item.id}: independentReviewer`);
    if (!iso(item.assignedAt)) failures.push(`${item.id}: assignedAt`);
  }

  if (item.state === 'in-review' && item.reviewedAt !== null) failures.push(`${item.id}: in-review item must keep reviewedAt null`);

  if (item.state === 'completed') {
    if (!iso(item.reviewedAt)) failures.push(`${item.id}: reviewedAt`);
    if (!isSha256(item.reviewPackageSha256)) failures.push(`${item.id}: reviewPackageSha256`);
    if (!['accept-result', 'accept-with-findings', 'reject-evidence'].includes(item.reviewDisposition)) failures.push(`${item.id}: reviewDisposition`);
    if (!bounded(item.reviewPackageRef, 512)) failures.push(`${item.id}: reviewPackageRef`);
  }

  if (item.targetHardwareQualified === true || item.closedTrackApproved === true || item.publicRoadApproved === true) {
    failures.push(`${item.id}: qualification/approval flags prohibited`);
  }
}

if ((queue.items?.length ?? 0) === 0 && queue.status !== 'empty-no-physical-review-items') failures.push('empty queue must use empty-no-physical-review-items status');
if ((queue.items?.length ?? 0) > 0 && queue.status === 'empty-no-physical-review-items') failures.push('non-empty queue cannot use empty status');

const stateCounts = {};
for (const state of allowedStates) stateCounts[state] = (queue.items ?? []).filter((item) => item.state === state).length;

const report = {
  schema: 'kingmast-physical-evidence-review-queue-validation/v1',
  version: '0.0.6',
  controlAuthority: 'none',
  valid: failures.length === 0,
  itemCount: queue.items?.length ?? 0,
  stateCounts,
  automaticReview: false,
  automaticRegistryMutation: false,
  targetHardwareQualified: false,
  closedTrackApproved: false,
  publicRoadApproved: false,
  failures
};

if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else console.log(`KINGMAST physical review queue: ${report.itemCount} item(s); valid=${report.valid}; registry automation disabled.`);
if (failures.length) process.exit(1);
