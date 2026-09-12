export type SotifCriticality = 'safety-critical' | 'safety-relevant' | 'supporting';
export type ResidualRiskDisposition = 'open' | 'research-accepted' | 'rejected';

export type SotifScenarioEvidence = {
  id: string;
  criticality: SotifCriticality;
  softwareTested: boolean;
  hilEvidence: boolean;
  controlledTrackEvidence: boolean;
  independentReview: boolean;
  residualRisk: ResidualRiskDisposition;
};

export type SotifCoveragePolicy = {
  requiredScenarioIds: string[];
  hilRequiredFor: SotifCriticality[];
  controlledTrackRequiredFor: SotifCriticality[];
  independentReviewRequiredFor: SotifCriticality[];
};

export type SotifCoverageAssessment = {
  status: 'blocked' | 'software-ready' | 'hil-ready' | 'track-ready' | 'review-ready';
  reason: string;
  missingScenarioIds: string[];
  blockers: string[];
  softwareCoverage: number;
  hilCoverage: number;
  controlledTrackCoverage: number;
  independentReviewCoverage: number;
  controlAuthority: 'none';
  qualificationClaim: false;
  publicRoadReady: false;
};

function ratio(pass: number, total: number) {
  return total === 0 ? 0 : pass / total;
}

function validId(id: string) {
  return /^S8-\d{3}$/.test(id);
}

export function assessSotifCoverageReadiness(
  evidence: SotifScenarioEvidence[],
  policy: SotifCoveragePolicy,
): SotifCoverageAssessment {
  const resultBase = {
    controlAuthority: 'none' as const,
    qualificationClaim: false as const,
    publicRoadReady: false as const,
  };
  const requiredIds = [...new Set(policy.requiredScenarioIds)];
  if (
    requiredIds.length === 0 ||
    requiredIds.length !== policy.requiredScenarioIds.length ||
    requiredIds.some((id) => !validId(id)) ||
    policy.hilRequiredFor.some((value) => !['safety-critical', 'safety-relevant', 'supporting'].includes(value)) ||
    policy.controlledTrackRequiredFor.some((value) => !['safety-critical', 'safety-relevant', 'supporting'].includes(value)) ||
    policy.independentReviewRequiredFor.some((value) => !['safety-critical', 'safety-relevant', 'supporting'].includes(value))
  ) {
    return {
      status: 'blocked', reason: 'invalid-coverage-policy', missingScenarioIds: [], blockers: ['invalid-coverage-policy'],
      softwareCoverage: 0, hilCoverage: 0, controlledTrackCoverage: 0, independentReviewCoverage: 0, ...resultBase,
    };
  }

  const byId = new Map<string, SotifScenarioEvidence>();
  const blockers: string[] = [];
  for (const item of evidence) {
    if (!validId(item.id) || byId.has(item.id)) blockers.push(`invalid-or-duplicate-scenario:${item.id}`);
    else byId.set(item.id, item);
  }
  const missingScenarioIds = requiredIds.filter((id) => !byId.has(id));
  if (missingScenarioIds.length) blockers.push(...missingScenarioIds.map((id) => `missing-scenario:${id}`));

  const required = requiredIds.map((id) => byId.get(id)).filter((item): item is SotifScenarioEvidence => Boolean(item));
  const softwarePass = required.filter((item) => item.softwareTested).length;
  const hilRequired = required.filter((item) => policy.hilRequiredFor.includes(item.criticality));
  const trackRequired = required.filter((item) => policy.controlledTrackRequiredFor.includes(item.criticality));
  const reviewRequired = required.filter((item) => policy.independentReviewRequiredFor.includes(item.criticality));
  const hilPass = hilRequired.filter((item) => item.hilEvidence).length;
  const trackPass = trackRequired.filter((item) => item.controlledTrackEvidence).length;
  const reviewPass = reviewRequired.filter((item) => item.independentReview).length;

  for (const item of required) {
    if (!item.softwareTested) blockers.push(`software-evidence-missing:${item.id}`);
    if (policy.hilRequiredFor.includes(item.criticality) && !item.hilEvidence) blockers.push(`hil-evidence-missing:${item.id}`);
    if (policy.controlledTrackRequiredFor.includes(item.criticality) && !item.controlledTrackEvidence) blockers.push(`controlled-track-evidence-missing:${item.id}`);
    if (policy.independentReviewRequiredFor.includes(item.criticality) && !item.independentReview) blockers.push(`independent-review-missing:${item.id}`);
    if (item.criticality === 'safety-critical' && item.residualRisk === 'open') blockers.push(`open-critical-residual-risk:${item.id}`);
  }

  const coverage = {
    softwareCoverage: ratio(softwarePass, requiredIds.length),
    hilCoverage: ratio(hilPass, hilRequired.length),
    controlledTrackCoverage: ratio(trackPass, trackRequired.length),
    independentReviewCoverage: ratio(reviewPass, reviewRequired.length),
  };
  if (missingScenarioIds.length || blockers.some((item) => item.startsWith('invalid-or-duplicate-scenario:'))) {
    return { status: 'blocked', reason: 'scenario-registry-integrity-failed', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  if (softwarePass < requiredIds.length) {
    return { status: 'blocked', reason: 'software-scenario-coverage-incomplete', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  if (hilPass < hilRequired.length) {
    return { status: 'software-ready', reason: 'hil-evidence-pending', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  if (trackPass < trackRequired.length) {
    return { status: 'hil-ready', reason: 'controlled-track-evidence-pending', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  if (reviewPass < reviewRequired.length) {
    return { status: 'track-ready', reason: 'independent-review-pending', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  if (required.some((item) => item.criticality === 'safety-critical' && item.residualRisk === 'open')) {
    return { status: 'blocked', reason: 'critical-residual-risk-open', missingScenarioIds, blockers, ...coverage, ...resultBase };
  }
  return {
    status: 'review-ready',
    reason: 'required-research-evidence-present-no-qualification-implied',
    missingScenarioIds,
    blockers,
    ...coverage,
    ...resultBase,
  };
}
