import { describe, expect, it } from 'vitest';
import { assessSotifCoverageReadiness, type SotifScenarioEvidence } from './sotif-coverage-readiness.js';

const policy = {
  requiredScenarioIds: ['S8-001', 'S8-005', 'S8-017'],
  hilRequiredFor: ['safety-critical', 'safety-relevant'] as const,
  controlledTrackRequiredFor: ['safety-critical'] as const,
  independentReviewRequiredFor: ['safety-critical', 'safety-relevant'] as const,
};
const scenario = (
  id: string,
  criticality: SotifScenarioEvidence['criticality'],
  patch: Partial<SotifScenarioEvidence> = {},
): SotifScenarioEvidence => ({
  id,
  criticality,
  softwareTested: true,
  hilEvidence: true,
  controlledTrackEvidence: true,
  independentReview: true,
  residualRisk: 'research-accepted',
  ...patch,
});
const complete = [
  scenario('S8-001', 'safety-critical'),
  scenario('S8-005', 'safety-relevant'),
  scenario('S8-017', 'supporting'),
];

describe('SOTIF coverage readiness', () => {
  it('blocks a missing required scenario instead of calculating optimistic coverage', () => {
    expect(assessSotifCoverageReadiness(complete.slice(0, 2), { ...policy, hilRequiredFor: [...policy.hilRequiredFor], controlledTrackRequiredFor: [...policy.controlledTrackRequiredFor], independentReviewRequiredFor: [...policy.independentReviewRequiredFor] })).toMatchObject({
      status: 'blocked', reason: 'scenario-registry-integrity-failed', missingScenarioIds: ['S8-017'],
    });
  });

  it('reports software-ready while required HIL evidence is still missing', () => {
    const evidence = complete.map((item) => item.id === 'S8-005' ? { ...item, hilEvidence: false } : item);
    expect(assessSotifCoverageReadiness(evidence, { ...policy, hilRequiredFor: [...policy.hilRequiredFor], controlledTrackRequiredFor: [...policy.controlledTrackRequiredFor], independentReviewRequiredFor: [...policy.independentReviewRequiredFor] })).toMatchObject({
      status: 'software-ready', reason: 'hil-evidence-pending', qualificationClaim: false,
    });
  });

  it('reports HIL-ready until controlled-track evidence exists for critical scenarios', () => {
    const evidence = complete.map((item) => item.id === 'S8-001' ? { ...item, controlledTrackEvidence: false } : item);
    expect(assessSotifCoverageReadiness(evidence, { ...policy, hilRequiredFor: [...policy.hilRequiredFor], controlledTrackRequiredFor: [...policy.controlledTrackRequiredFor], independentReviewRequiredFor: [...policy.independentReviewRequiredFor] })).toMatchObject({
      status: 'hil-ready', reason: 'controlled-track-evidence-pending', publicRoadReady: false,
    });
  });

  it('blocks an open critical residual risk even after evidence and review are present', () => {
    const evidence = complete.map((item) => item.id === 'S8-001' ? { ...item, residualRisk: 'open' as const } : item);
    expect(assessSotifCoverageReadiness(evidence, { ...policy, hilRequiredFor: [...policy.hilRequiredFor], controlledTrackRequiredFor: [...policy.controlledTrackRequiredFor], independentReviewRequiredFor: [...policy.independentReviewRequiredFor] })).toMatchObject({
      status: 'blocked', reason: 'critical-residual-risk-open', qualificationClaim: false, publicRoadReady: false,
    });
  });

  it('can reach review-ready research status but never auto-qualifies or enables road use', () => {
    expect(assessSotifCoverageReadiness(complete, { ...policy, hilRequiredFor: [...policy.hilRequiredFor], controlledTrackRequiredFor: [...policy.controlledTrackRequiredFor], independentReviewRequiredFor: [...policy.independentReviewRequiredFor] })).toMatchObject({
      status: 'review-ready', softwareCoverage: 1, hilCoverage: 1, controlledTrackCoverage: 1,
      independentReviewCoverage: 1, controlAuthority: 'none', qualificationClaim: false, publicRoadReady: false,
    });
  });
});
