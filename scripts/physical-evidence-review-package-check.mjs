import {existsSync, readFileSync} from 'node:fs';

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

function nonEmpty(value, max = 512) {
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

function validate(payload) {
  const failures = [];
  const fail = (message) => failures.push(message);

  if (payload?.schema !== 'kingmast-physical-evidence-review-package/v1') fail('schema');
  if (payload?.version !== '0.0.6') fail('version');
  if (payload?.controlAuthority !== 'none') fail('controlAuthority');
  if (payload?.automaticQualification !== false || payload?.automaticRegistryMutation !== false) fail('automation boundary');
  if (payload?.targetHardwareQualified !== false || payload?.closedTrackApproved !== false || payload?.publicRoadApproved !== false) fail('qualification/approval boundary');

  if (payload?.status === 'template') {
    for (const key of [
      'evidenceClass',
      'scenarioId',
      'sourceSoftwareCommit',
      'capturePackageSha256',
      'operator',
      'independentReviewer',
      'reviewedAt',
      'reviewDisposition',
      'reviewedScenarioResult'
    ]) {
      if (payload[key] !== null) fail(`template ${key} must be null`);
    }
    if (!Array.isArray(payload.findings) || payload.findings.length !== 0) fail('template findings');
    if (!Array.isArray(payload.reviewEvidenceRefs) || payload.reviewEvidenceRefs.length !== 0) fail('template reviewEvidenceRefs');
    return {valid: failures.length === 0, failures, template: true};
  }

  if (payload?.status !== 'complete') fail('status');
  if (!['hil', 'closed-track'].includes(payload?.evidenceClass)) fail('evidenceClass');
  if (payload?.evidenceClass === 'hil' && !/^HIL-\d{3}$/.test(payload?.scenarioId ?? '')) fail('HIL scenarioId');
  if (payload?.evidenceClass === 'closed-track' && !/^CT-\d{3}$/.test(payload?.scenarioId ?? '')) fail('closed-track scenarioId');
  if (!isCommit(payload?.sourceSoftwareCommit)) fail('sourceSoftwareCommit');
  if (!isSha256(payload?.capturePackageSha256)) fail('capturePackageSha256');
  if (!nonEmpty(payload?.operator, 200)) fail('operator');
  if (!nonEmpty(payload?.independentReviewer, 200)) fail('independentReviewer');
  if (payload?.operator === payload?.independentReviewer) fail('reviewer independence');
  if (!validIso(payload?.reviewedAt)) fail('reviewedAt');
  if (!['accept-result', 'accept-with-findings', 'reject-evidence'].includes(payload?.reviewDisposition)) fail('reviewDisposition');

  if (payload?.reviewDisposition === 'reject-evidence') {
    if (payload?.reviewedScenarioResult !== null) fail('rejected evidence must not create scenario result');
  } else if (!['pass', 'fail'].includes(payload?.reviewedScenarioResult)) {
    fail('accepted evidence requires reviewedScenarioResult');
  }

  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  if (!Array.isArray(payload?.findings)) fail('findings array');
  if (payload?.reviewDisposition === 'accept-with-findings' && findings.length < 1) fail('accept-with-findings requires findings');
  for (const finding of findings) {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      fail('finding object');
      continue;
    }
    if (!/^FIND-[A-Z0-9-]{2,80}$/.test(finding.id ?? '')) fail('finding id');
    if (!nonEmpty(finding.summary, 1000)) fail('finding summary');
    if (!['open', 'resolved', 'accepted-risk'].includes(finding.status)) fail('finding status');
    if (finding.status === 'resolved' && !nonEmpty(finding.resolutionRef, 512)) fail('resolved finding resolutionRef');
  }

  const refs = Array.isArray(payload?.reviewEvidenceRefs) ? payload.reviewEvidenceRefs : [];
  if (refs.length < 1 || refs.length > 64) fail('reviewEvidenceRefs');
  const seen = new Set();
  for (const item of refs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('review evidence item');
      continue;
    }
    if (!nonEmpty(item.ref, 512) || seen.has(item.ref)) fail('review evidence ref');
    seen.add(item.ref);
    if (!isSha256(item.sha256)) fail('review evidence sha256');
  }

  return {valid: failures.length === 0, failures, template: false};
}

function fixture() {
  return {
    schema: 'kingmast-physical-evidence-review-package/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    status: 'complete',
    evidenceClass: 'hil',
    scenarioId: 'HIL-001',
    sourceSoftwareCommit: 'a'.repeat(40),
    capturePackageSha256: 'b'.repeat(64),
    operator: 'operator-a',
    independentReviewer: 'reviewer-b',
    reviewedAt: '2026-09-09T00:05:00Z',
    reviewDisposition: 'accept-result',
    reviewedScenarioResult: 'pass',
    findings: [],
    reviewEvidenceRefs: [{ref: 'review://HIL-001/checklist', sha256: 'c'.repeat(64)}],
    automaticQualification: false,
    automaticRegistryMutation: false,
    targetHardwareQualified: false,
    closedTrackApproved: false,
    publicRoadApproved: false
  };
}

if (selftest) {
  const cases = [];
  const base = fixture();
  cases.push(validate(base).valid);

  const sameReviewer = structuredClone(base);
  sameReviewer.independentReviewer = sameReviewer.operator;
  cases.push(!validate(sameReviewer).valid);

  const missingDigest = structuredClone(base);
  missingDigest.reviewEvidenceRefs[0].sha256 = null;
  cases.push(!validate(missingDigest).valid);

  const publicRoad = structuredClone(base);
  publicRoad.publicRoadApproved = true;
  cases.push(!validate(publicRoad).valid);

  const badScenario = structuredClone(base);
  badScenario.evidenceClass = 'closed-track';
  cases.push(!validate(badScenario).valid);

  const noFinding = structuredClone(base);
  noFinding.reviewDisposition = 'accept-with-findings';
  cases.push(!validate(noFinding).valid);

  const rejectedCreatesPass = structuredClone(base);
  rejectedCreatesPass.reviewDisposition = 'reject-evidence';
  cases.push(!validate(rejectedCreatesPass).valid);

  const report = {
    schema: 'kingmast-physical-evidence-review-selftest/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    fixtureOnly: true,
    physicalReviewPerformed: false,
    automaticRegistryMutation: false,
    targetHardwareQualified: false,
    closedTrackApproved: false,
    publicRoadApproved: false,
    total: cases.length,
    passed: cases.filter(Boolean).length,
    failed: cases.filter((item) => !item).length,
    allPassed: cases.every(Boolean)
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else console.log(`KINGMAST physical review package self-test ${report.passed}/${report.total}`);
  if (!report.allPassed) process.exit(1);
} else {
  const path = valueAfter('--package', 'docs/review/V006_PHYSICAL_EVIDENCE_REVIEW_PACKAGE_TEMPLATE.json');
  if (!existsSync(path)) throw new Error(`Review package not found: ${path}`);
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const result = validate(payload);
  const report = {
    schema: 'kingmast-physical-evidence-review-package-validation/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    valid: result.valid,
    template: result.template,
    automaticRegistryMutation: false,
    targetHardwareQualified: false,
    closedTrackApproved: false,
    publicRoadApproved: false,
    failures: result.failures
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else console.log(`KINGMAST physical evidence review package ${result.valid ? 'valid' : 'invalid'}; template=${result.template}.`);
  if (!result.valid) process.exit(1);
}
