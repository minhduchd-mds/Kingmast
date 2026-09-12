export type WarningEvidenceSource =
  | 'sil-oracle'
  | 'hil-ground-truth'
  | 'controlled-track-ground-truth'
  | 'field-report';

export type WarningOutcomeEvidence = {
  id: string;
  observedAtMs: number;
  label: 'true-positive' | 'false-positive' | 'unresolved';
  source: WarningEvidenceSource;
  independentlyReviewed: boolean;
};

export type FalsePositiveEvidencePolicy = {
  maxAgeMs: number;
  minReviewedSamples: number;
  maxFalsePositiveRate: number;
  zScore: number;
};

export type FalsePositiveEvidenceAssessment = {
  status: 'insufficient-evidence' | 'software-evidence' | 'physical-evidence' | 'blocked';
  reason: string;
  reviewedSamples: number;
  falsePositives: number;
  pointRate: number | null;
  upperConfidenceBound: number | null;
  physicalReviewedSamples: number;
  physicalEvidenceReady: boolean;
  ignoredSamples: number;
  autoThresholdTuningAllowed: false;
  qualificationClaim: false;
};

const groundTruthSources = new Set<WarningEvidenceSource>([
  'sil-oracle',
  'hil-ground-truth',
  'controlled-track-ground-truth',
]);

function wilsonUpper(falsePositives: number, samples: number, z: number) {
  if (samples <= 0) return null;
  const p = falsePositives / samples;
  const z2 = z * z;
  const denominator = 1 + z2 / samples;
  const centre = p + z2 / (2 * samples);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * samples)) / samples);
  return Math.min(1, (centre + spread) / denominator);
}

function invalidPolicy(policy: FalsePositiveEvidencePolicy) {
  return !Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0 ||
    !Number.isInteger(policy.minReviewedSamples) || policy.minReviewedSamples < 1 ||
    !Number.isFinite(policy.maxFalsePositiveRate) || policy.maxFalsePositiveRate < 0 || policy.maxFalsePositiveRate > 1 ||
    !Number.isFinite(policy.zScore) || policy.zScore <= 0;
}

export function assessFalsePositiveEvidence(
  evidence: WarningOutcomeEvidence[],
  nowMs: number,
  policy: FalsePositiveEvidencePolicy,
): FalsePositiveEvidenceAssessment {
  const base = {
    physicalEvidenceReady: false,
    autoThresholdTuningAllowed: false as const,
    qualificationClaim: false as const,
  };
  if (!Number.isFinite(nowMs) || invalidPolicy(policy)) {
    return { status: 'blocked', reason: 'invalid-evidence-policy', reviewedSamples: 0, falsePositives: 0, pointRate: null, upperConfidenceBound: null, physicalReviewedSamples: 0, ignoredSamples: evidence.length, ...base };
  }

  const ids = new Set<string>();
  for (const item of evidence) {
    if (!item.id || ids.has(item.id)) {
      return { status: 'blocked', reason: 'duplicate-or-empty-evidence-id', reviewedSamples: 0, falsePositives: 0, pointRate: null, upperConfidenceBound: null, physicalReviewedSamples: 0, ignoredSamples: evidence.length, ...base };
    }
    ids.add(item.id);
    if (!Number.isFinite(item.observedAtMs) || item.observedAtMs > nowMs) {
      return { status: 'blocked', reason: 'invalid-or-future-evidence-time', reviewedSamples: 0, falsePositives: 0, pointRate: null, upperConfidenceBound: null, physicalReviewedSamples: 0, ignoredSamples: evidence.length, ...base };
    }
  }

  const eligible = evidence.filter((item) =>
    nowMs - item.observedAtMs <= policy.maxAgeMs &&
    item.independentlyReviewed &&
    item.label !== 'unresolved' &&
    groundTruthSources.has(item.source),
  );
  const ignoredSamples = evidence.length - eligible.length;
  const falsePositives = eligible.filter((item) => item.label === 'false-positive').length;
  const reviewedSamples = eligible.length;
  const pointRate = reviewedSamples ? falsePositives / reviewedSamples : null;
  const upperConfidenceBound = wilsonUpper(falsePositives, reviewedSamples, policy.zScore);

  if (reviewedSamples < policy.minReviewedSamples || upperConfidenceBound == null) {
    return { status: 'insufficient-evidence', reason: 'minimum-reviewed-ground-truth-not-met', reviewedSamples, falsePositives, pointRate, upperConfidenceBound, physicalReviewedSamples: eligible.filter((item) => item.source === 'controlled-track-ground-truth').length, ignoredSamples, ...base };
  }
  if (upperConfidenceBound > policy.maxFalsePositiveRate) {
    return { status: 'blocked', reason: 'reviewed-false-positive-upper-bound-exceeds-policy', reviewedSamples, falsePositives, pointRate, upperConfidenceBound, physicalReviewedSamples: eligible.filter((item) => item.source === 'controlled-track-ground-truth').length, ignoredSamples, ...base };
  }

  const physical = eligible.filter((item) => item.source === 'controlled-track-ground-truth');
  const physicalFalsePositives = physical.filter((item) => item.label === 'false-positive').length;
  const physicalUpper = wilsonUpper(physicalFalsePositives, physical.length, policy.zScore);
  const physicalEvidenceReady = physical.length >= policy.minReviewedSamples && physicalUpper != null && physicalUpper <= policy.maxFalsePositiveRate;
  return {
    status: physicalEvidenceReady ? 'physical-evidence' : 'software-evidence',
    reason: physicalEvidenceReady ? 'controlled-track-evidence-meets-reviewed-bound' : 'software-or-hil-evidence-only',
    reviewedSamples,
    falsePositives,
    pointRate,
    upperConfidenceBound,
    physicalReviewedSamples: physical.length,
    physicalEvidenceReady,
    ignoredSamples,
    autoThresholdTuningAllowed: false,
    qualificationClaim: false,
  };
}
