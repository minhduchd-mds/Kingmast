import { describe, expect, it } from 'vitest';
import { assessFalsePositiveEvidence, type WarningOutcomeEvidence } from './false-positive-evidence.js';

const policy = { maxAgeMs: 100_000, minReviewedSamples: 10, maxFalsePositiveRate: 0.5, zScore: 1.96 };
const batch = (source: WarningOutcomeEvidence['source'], falsePositives = 0): WarningOutcomeEvidence[] =>
  Array.from({ length: 10 }, (_, index) => ({
    id: `${source}-${index}`,
    observedAtMs: 1_000 + index,
    label: index < falsePositives ? 'false-positive' : 'true-positive',
    source,
    independentlyReviewed: true,
  }));

describe('false-positive evidence assurance', () => {
  it('accepts reviewed software/HIL evidence without calling it physical evidence', () => {
    expect(assessFalsePositiveEvidence(batch('hil-ground-truth'), 2_000, policy)).toMatchObject({
      status: 'software-evidence', physicalEvidenceReady: false, qualificationClaim: false,
    });
  });

  it('requires controlled-track ground truth before physical evidence is ready', () => {
    expect(assessFalsePositiveEvidence(batch('controlled-track-ground-truth'), 2_000, policy)).toMatchObject({
      status: 'physical-evidence', physicalEvidenceReady: true, physicalReviewedSamples: 10,
    });
  });

  it('blocks when the conservative false-positive upper bound exceeds policy', () => {
    expect(assessFalsePositiveEvidence(batch('hil-ground-truth', 6), 2_000, policy)).toMatchObject({
      status: 'blocked', reason: 'reviewed-false-positive-upper-bound-exceeds-policy',
    });
  });

  it('does not count field reports, unresolved labels or unreviewed samples as ground truth', () => {
    const evidence: WarningOutcomeEvidence[] = [
      ...batch('field-report'),
      { id: 'unresolved', observedAtMs: 1_100, label: 'unresolved', source: 'controlled-track-ground-truth', independentlyReviewed: true },
      { id: 'unreviewed', observedAtMs: 1_101, label: 'true-positive', source: 'controlled-track-ground-truth', independentlyReviewed: false },
    ];
    expect(assessFalsePositiveEvidence(evidence, 2_000, policy)).toMatchObject({
      status: 'insufficient-evidence', reviewedSamples: 0, ignoredSamples: 12,
    });
  });

  it('never enables automatic threshold tuning from accumulated outcomes', () => {
    expect(assessFalsePositiveEvidence(batch('controlled-track-ground-truth'), 2_000, policy).autoThresholdTuningAllowed).toBe(false);
  });
});
