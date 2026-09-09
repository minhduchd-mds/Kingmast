import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const argv = process.argv.slice(2);
const jsonMode = argv.includes('--json');
const selftest = argv.includes('--selftest');

function valueAfter(flag, fallback) {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value after ${flag}`);
  return value;
}

function nonEmpty(value, max = 2048) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\r\n\t]/.test(value);
}

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function validIso(value) {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const scenarioIds = new Set(Array.from({length: 8}, (_, index) => `CT-${String(index + 1).padStart(3, '0')}`));

function validate(payload, expectedSourceCommit = null, bytes = null) {
  const failures = [];
  const fail = (message) => failures.push(message);

  if (payload?.schema !== 'kingmast-closed-track-evidence-package/v1') fail('schema');
  if (payload?.version !== '0.0.6') fail('version');
  if (!scenarioIds.has(payload?.scenarioId)) fail('scenarioId');
  if (payload?.claim !== 'physical-controlled-track-result') fail('claim');
  if (!['passed', 'failed'].includes(payload?.status)) fail('status');
  if (payload?.controlAuthority !== 'none') fail('controlAuthority');
  if (payload?.closedTrackApproved !== false || payload?.targetHardwareQualified !== false || payload?.publicRoadApproved !== false) fail('qualification/approval boundary');
  if (payload?.automaticQualification !== false || payload?.registryMutation !== false) fail('automation boundary');
  if (payload?.reviewDisposition !== 'captured-awaiting-independent-review') fail('reviewDisposition');

  const result = payload?.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail('result');
  } else {
    if (!isCommit(result.softwareCommit)) fail('softwareCommit');
    if (expectedSourceCommit && result.softwareCommit?.toLowerCase() !== expectedSourceCommit.toLowerCase()) fail('source mismatch');
    if (!validIso(result.startedAt) || !validIso(result.finishedAt) || Date.parse(result.finishedAt) < Date.parse(result.startedAt)) fail('timestamps');

    for (const key of [
      'operator',
      'reviewer',
      'independentObserver',
      'entryApprovalRef',
      'testFacilityId',
      'vehicleOrRigId',
      'configurationRevision',
      'calibrationRevision',
      'approvedBoundsRef',
      'timeSyncRef'
    ]) {
      if (!nonEmpty(result[key], 512)) fail(key);
    }

    if (result.operator === result.reviewer) fail('reviewer independence');
    if (result.operator === result.independentObserver) fail('observer independence');
    if (result.reviewer === result.independentObserver) fail('reviewer/observer independence');

    const refs = Array.isArray(result.evidenceRefs) ? result.evidenceRefs : [];
    const digests = Array.isArray(result.evidenceDigests) ? result.evidenceDigests : [];
    if (refs.length < 1 || refs.length > 64 || refs.some((item) => !nonEmpty(item, 512)) || new Set(refs).size !== refs.length) fail('evidenceRefs');

    const digestMap = new Map();
    for (const item of digests) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !nonEmpty(item.ref, 512) || !isSha256(item.sha256) || digestMap.has(item.ref)) {
        fail('evidenceDigests');
        continue;
      }
      digestMap.set(item.ref, item.sha256);
    }
    if (refs.some((ref) => !digestMap.has(ref)) || digestMap.size !== refs.length) fail('evidence digest binding');
    if (!nonEmpty(result.resultSummary, 2048)) fail('resultSummary');
  }

  const binding = payload?.sourceCommitBinding;
  if (!binding || !isCommit(binding.expected) || binding.matched !== true) {
    fail('sourceCommitBinding');
  } else if (result && isCommit(result.softwareCommit) && binding.expected.toLowerCase() !== result.softwareCommit.toLowerCase()) {
    fail('source binding mismatch');
  }

  return {
    valid: failures.length === 0,
    failures,
    packageSha256: bytes ? digest(bytes) : null,
    scenarioId: payload?.scenarioId ?? null,
    sourceSoftwareCommit: isCommit(result?.softwareCommit) ? result.softwareCommit.toLowerCase() : null,
    packageStatus: payload?.status ?? null,
    evidenceReferenceCount: Array.isArray(result?.evidenceRefs) ? result.evidenceRefs.length : 0,
    facilityId: nonEmpty(result?.testFacilityId, 512) ? result.testFacilityId : null
  };
}

function fixture() {
  const commit = 'a'.repeat(40);
  return {
    schema: 'kingmast-closed-track-evidence-package/v1',
    version: '0.0.6',
    scenarioId: 'CT-001',
    claim: 'physical-controlled-track-result',
    status: 'passed',
    controlAuthority: 'none',
    closedTrackApproved: false,
    targetHardwareQualified: false,
    publicRoadApproved: false,
    automaticQualification: false,
    registryMutation: false,
    reviewDisposition: 'captured-awaiting-independent-review',
    sourceCommitBinding: {expected: commit, matched: true},
    result: {
      softwareCommit: commit,
      startedAt: '2026-09-09T00:00:00Z',
      finishedAt: '2026-09-09T00:05:00Z',
      operator: 'operator-a',
      reviewer: 'reviewer-b',
      independentObserver: 'observer-c',
      entryApprovalRef: 'approval://entry',
      testFacilityId: 'facility-a',
      vehicleOrRigId: 'rig-a',
      configurationRevision: 'cfg-a',
      calibrationRevision: 'cal-a',
      approvedBoundsRef: 'bounds://CT-001',
      timeSyncRef: 'timesync://session-a',
      evidenceRefs: ['evidence://CT-001/raw'],
      evidenceDigests: [{ref: 'evidence://CT-001/raw', sha256: 'b'.repeat(64)}],
      resultSummary: 'controlled-track fixture result'
    }
  };
}

if (selftest) {
  const base = fixture();
  const cases = [];
  cases.push(validate(base, 'a'.repeat(40)).valid);

  const publicRoad = structuredClone(base);
  publicRoad.publicRoadApproved = true;
  cases.push(!validate(publicRoad).valid);

  const duplicateRef = structuredClone(base);
  duplicateRef.result.evidenceRefs.push('evidence://CT-001/raw');
  cases.push(!validate(duplicateRef).valid);

  const sourceMismatch = structuredClone(base);
  sourceMismatch.sourceCommitBinding.expected = 'c'.repeat(40);
  cases.push(!validate(sourceMismatch).valid);

  const authority = structuredClone(base);
  authority.controlAuthority = 'write';
  cases.push(!validate(authority).valid);

  const sameObserver = structuredClone(base);
  sameObserver.result.independentObserver = sameObserver.result.operator;
  cases.push(!validate(sameObserver).valid);

  const registryMutation = structuredClone(base);
  registryMutation.registryMutation = true;
  cases.push(!validate(registryMutation).valid);

  const report = {
    schema: 'kingmast-closed-track-evidence-ingestion-selftest/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    fixtureOnly: true,
    physicalClosedTrackExecuted: false,
    automaticRegistryMutation: false,
    closedTrackApproved: false,
    targetHardwareQualified: false,
    publicRoadApproved: false,
    total: cases.length,
    passed: cases.filter(Boolean).length,
    failed: cases.filter((item) => !item).length,
    allPassed: cases.every(Boolean)
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else console.log(`KINGMAST controlled-track ingestion self-test ${report.passed}/${report.total}`);
  if (!report.allPassed) process.exit(1);
} else {
  const path = valueAfter('--package', null);
  if (!path) throw new Error('Use --package <file> or --selftest');
  if (!existsSync(path)) throw new Error(`Package not found: ${path}`);
  const bytes = readFileSync(path);
  const payload = JSON.parse(bytes.toString('utf8'));
  const expected = valueAfter('--expected-source-commit', process.env.GITHUB_SHA ?? null);
  if (expected && !isCommit(expected)) throw new Error('Expected source commit must be a full 40-character SHA');

  const result = validate(payload, expected, bytes);
  const output = {
    schema: 'kingmast-closed-track-evidence-ingestion-record/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    ingestible: result.valid,
    scenarioId: result.scenarioId,
    sourceSoftwareCommit: result.sourceSoftwareCommit,
    packageSha256: result.packageSha256,
    packageStatus: result.packageStatus,
    facilityId: result.facilityId,
    reviewStatus: 'pending-independent-review',
    evidenceReferenceCount: result.evidenceReferenceCount,
    physicalEvidenceStoreRegistrationRequired: true,
    automaticRegistryMutation: false,
    closedTrackApproved: false,
    targetHardwareQualified: false,
    publicRoadApproved: false,
    failures: result.failures
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  else console.log(`KINGMAST controlled-track ingestion ${output.ingestible ? 'accepted-for-review' : 'rejected'}; registry unchanged.`);
  if (!result.valid) process.exit(1);
}
