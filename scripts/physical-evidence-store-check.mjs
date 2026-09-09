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

function load(path, label) {
  if (!existsSync(path)) throw new Error(`${label} not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function bounded(value, max = 512) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\r\n\t]/.test(value);
}

function objectRefSafe(value) {
  return bounded(value, 512) && !/[\s?#]/.test(value) && !/@/.test(value);
}

function validateRecord(record, policy) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {valid: false, failures: ['record must be object']};

  if (!/^EV-[A-Z0-9-]{4,80}$/.test(record.recordId ?? '')) fail('recordId');
  if (!policy.allowedEvidenceClasses.includes(record.evidenceClass)) fail('evidenceClass');
  if (!isCommit(record.sourceSoftwareCommit)) fail('sourceSoftwareCommit');
  if (!isSha256(record.packageSha256)) fail('packageSha256');
  if (!isIso(record.capturedAt)) fail('capturedAt');
  if (!objectRefSafe(record.objectRef)) fail('objectRef');
  if (!Object.hasOwn(policy.retentionClasses, record.retentionClass)) fail('retentionClass');
  if (!['object-lock', 'write-once', 'append-only-reviewed'].includes(record.immutabilityMode)) fail('immutabilityMode');
  if (record.encryptedAtRest !== true) fail('encryptedAtRest');
  if (record.accessControlReviewed !== true) fail('accessControlReviewed');
  if (record.contentDigestVerified !== true) fail('contentDigestVerified');
  if (!['pending-independent-review', 'reviewed'].includes(record.reviewStatus)) fail('reviewStatus');

  if (record.evidenceClass === 'hil' && !/^HIL-\d{3}$/.test(record.scenarioId ?? '')) fail('HIL scenarioId');
  if (record.evidenceClass === 'closed-track' && !/^CT-\d{3}$/.test(record.scenarioId ?? '')) fail('closed-track scenarioId');

  const digests = Array.isArray(record.evidenceDigests) ? record.evidenceDigests : [];
  if (digests.length < 1 || digests.length > 64) fail('evidenceDigests');
  const refs = new Set();
  for (const item of digests) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail('evidence digest item');
      continue;
    }
    if (!bounded(item.ref, 512) || refs.has(item.ref)) fail('evidence digest ref');
    refs.add(item.ref);
    if (!isSha256(item.sha256)) fail('evidence digest sha256');
  }

  for (const key of [
    'rawHardwareSerial',
    'secret',
    'secrets',
    'privateKey',
    'accessToken',
    'password',
    'preciseCoordinates',
    'rawCabinVideo',
    'rawCameraFrames'
  ]) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== false) fail(`prohibited metadata ${key}`);
  }

  if (record.targetHardwareQualified === true || record.closedTrackApproved === true || record.publicRoadApproved === true) {
    fail('qualification/approval flags prohibited');
  }

  return {valid: failures.length === 0, failures};
}

function validate(policy, index) {
  const failures = [];
  const expect = (label, condition) => { if (!condition) failures.push(label); };

  expect('policy schema', policy.schema === 'kingmast-physical-evidence-store-policy/v1');
  expect('policy version', policy.version === '0.0.6');
  expect('index schema', index.schema === 'kingmast-physical-evidence-store-index/v1');
  expect('index version', index.version === '0.0.6');
  expect('control authority none', policy.controlAuthority === 'none' && index.controlAuthority === 'none');
  expect('repository raw evidence disabled', policy.repositoryStoresRawEvidence === false);
  expect('policy automatic qualification false', policy.automaticQualification === false);
  expect('policy automatic registry mutation false', policy.automaticRegistryMutation === false);
  expect('index automatic qualification false', index.automaticQualification === false);
  expect('index automatic registry mutation false', index.automaticRegistryMutation === false);
  expect('no target qualification', policy.targetHardwareQualified === false && index.targetHardwareQualified === false);
  expect('no track approval', policy.closedTrackApproved === false && index.closedTrackApproved === false);
  expect('no public-road approval', policy.publicRoadApproved === false && index.publicRoadApproved === false);
  expect('allowed evidence classes', Array.isArray(policy.allowedEvidenceClasses) && policy.allowedEvidenceClasses.length >= 5);
  expect('required record fields', Array.isArray(policy.requiredRecordFields) && policy.requiredRecordFields.length >= 10);
  expect('retention classes', policy.retentionClasses && typeof policy.retentionClasses === 'object');
  expect('index records array', Array.isArray(index.records));

  const recordIds = new Set();
  const packageDigests = new Set();
  for (const record of index.records ?? []) {
    const result = validateRecord(record, policy);
    for (const failure of result.failures) failures.push(`${record?.recordId ?? '<unknown>'}: ${failure}`);
    if (recordIds.has(record?.recordId)) failures.push(`duplicate recordId ${String(record?.recordId)}`);
    recordIds.add(record?.recordId);
    if (packageDigests.has(record?.packageSha256)) failures.push(`duplicate packageSha256 ${String(record?.packageSha256)}`);
    packageDigests.add(record?.packageSha256);
  }

  if (index.backendConfigured !== true && (index.records?.length ?? 0) !== 0) {
    failures.push('unconfigured backend cannot contain registered records');
  }
  if (index.backendConfigured === true && index.status === 'empty-backend-not-provisioned') {
    failures.push('configured backend cannot use unprovisioned status');
  }

  return {
    valid: failures.length === 0,
    failures,
    backendConfigured: index.backendConfigured === true,
    recordCount: index.records?.length ?? 0
  };
}

const policyPath = valueAfter('--policy', 'docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_POLICY.json');
const indexPath = valueAfter('--index', 'docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_INDEX.json');
const policy = load(policyPath, 'physical evidence store policy');

if (selftest) {
  const validIndex = {
    schema: 'kingmast-physical-evidence-store-index/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    status: 'configured-protected-store',
    backendConfigured: true,
    automaticQualification: false,
    automaticRegistryMutation: false,
    targetHardwareQualified: false,
    closedTrackApproved: false,
    publicRoadApproved: false,
    records: [{
      recordId: 'EV-HIL-001-A',
      evidenceClass: 'hil',
      scenarioId: 'HIL-001',
      sourceSoftwareCommit: 'a'.repeat(40),
      packageSha256: 'b'.repeat(64),
      capturedAt: '2026-09-09T00:00:00Z',
      objectRef: 'evidence://qualification/HIL-001/package.json',
      retentionClass: 'qualification',
      immutabilityMode: 'object-lock',
      encryptedAtRest: true,
      accessControlReviewed: true,
      contentDigestVerified: true,
      evidenceDigests: [{ref: 'evidence://qualification/HIL-001/raw.bin', sha256: 'c'.repeat(64)}],
      reviewStatus: 'pending-independent-review'
    }]
  };

  const cases = [];
  cases.push(validate(policy, validIndex).valid);

  const duplicate = structuredClone(validIndex);
  duplicate.records.push({...duplicate.records[0], recordId: 'EV-HIL-001-B'});
  cases.push(!validate(policy, duplicate).valid);

  const sensitive = structuredClone(validIndex);
  sensitive.records[0].rawHardwareSerial = 'SERIAL-123';
  cases.push(!validate(policy, sensitive).valid);

  const credentialRef = structuredClone(validIndex);
  credentialRef.records[0].objectRef = 's3://user:secret@bucket/key';
  cases.push(!validate(policy, credentialRef).valid);

  const authority = structuredClone(validIndex);
  authority.publicRoadApproved = true;
  cases.push(!validate(policy, authority).valid);

  const report = {
    schema: 'kingmast-physical-evidence-store-selftest/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    fixtureOnly: true,
    physicalEvidenceStored: false,
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
  else console.log(`KINGMAST physical evidence store self-test ${report.passed}/${report.total}`);
  if (!report.allPassed) process.exit(1);
} else {
  const index = load(indexPath, 'physical evidence store index');
  const result = validate(policy, index);
  const report = {
    schema: 'kingmast-physical-evidence-store-validation/v1',
    version: '0.0.6',
    controlAuthority: 'none',
    softwareContractValid: result.valid,
    backendConfigured: result.backendConfigured,
    recordCount: result.recordCount,
    repositoryStoresRawEvidence: false,
    physicalEvidenceStoreReady: result.valid && result.backendConfigured,
    automaticQualification: false,
    automaticRegistryMutation: false,
    targetHardwareQualified: false,
    closedTrackApproved: false,
    publicRoadApproved: false,
    failures: result.failures
  };
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else console.log(`KINGMAST physical evidence store: contract ${report.softwareContractValid ? 'valid' : 'invalid'}; backend ${report.backendConfigured ? 'configured' : 'not configured'}; records ${report.recordCount}.`);
  if (!result.valid) process.exit(1);
}
