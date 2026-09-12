export type EnvironmentObservation = {
  observedAtMs: number;
  visibilityM: number | null;
  illuminanceLux: number | null;
  precipitationRateMmH: number | null;
  glareObserved: boolean | null;
  cameraObstructionFraction: number | null;
};

export type EnvironmentEnvelopePolicy = {
  reviewed: boolean;
  maxAgeMs: number;
  minVisibilityM: number;
  minIlluminanceLux: number;
  maxPrecipitationRateMmH: number;
  maxCameraObstructionFraction: number;
};

export type EnvironmentEnvelopeAssessment = {
  status: 'nominal' | 'degraded' | 'outside-envelope' | 'unavailable';
  reason: string;
  cameraSemanticAllowed: boolean;
  fusionAllowed: boolean;
  qualificationClaim: false;
};

const unavailable = (reason: string): EnvironmentEnvelopeAssessment => ({
  status: 'unavailable',
  reason,
  cameraSemanticAllowed: false,
  fusionAllowed: false,
  qualificationClaim: false,
});

export function assessEnvironmentValidityEnvelope(
  observation: EnvironmentObservation | null,
  nowMs: number,
  policy: EnvironmentEnvelopePolicy,
): EnvironmentEnvelopeAssessment {
  const policyValues = [
    policy.maxAgeMs,
    policy.minVisibilityM,
    policy.minIlluminanceLux,
    policy.maxPrecipitationRateMmH,
    policy.maxCameraObstructionFraction,
  ];
  if (
    !policy.reviewed ||
    !Number.isFinite(nowMs) ||
    policyValues.some((value) => !Number.isFinite(value)) ||
    policy.maxAgeMs < 0 ||
    policy.minVisibilityM < 0 ||
    policy.minIlluminanceLux < 0 ||
    policy.maxPrecipitationRateMmH < 0 ||
    policy.maxCameraObstructionFraction <= 0 ||
    policy.maxCameraObstructionFraction > 1
  ) return unavailable('unreviewed-or-invalid-envelope-policy');

  if (!observation || !Number.isFinite(observation.observedAtMs)) return unavailable('environment-evidence-unavailable');
  if (observation.observedAtMs > nowMs) return unavailable('future-dated-environment-evidence');
  if (nowMs - observation.observedAtMs > policy.maxAgeMs) return unavailable('stale-environment-evidence');

  const { visibilityM, illuminanceLux, precipitationRateMmH, glareObserved, cameraObstructionFraction } = observation;
  if (
    visibilityM == null || illuminanceLux == null || precipitationRateMmH == null ||
    glareObserved == null || cameraObstructionFraction == null
  ) return unavailable('required-environment-dimension-unobserved');
  if (
    !Number.isFinite(visibilityM) || visibilityM < 0 ||
    !Number.isFinite(illuminanceLux) || illuminanceLux < 0 ||
    !Number.isFinite(precipitationRateMmH) || precipitationRateMmH < 0 ||
    !Number.isFinite(cameraObstructionFraction) || cameraObstructionFraction < 0 || cameraObstructionFraction > 1
  ) return unavailable('invalid-environment-observation');

  if (
    visibilityM < policy.minVisibilityM ||
    precipitationRateMmH > policy.maxPrecipitationRateMmH ||
    cameraObstructionFraction >= policy.maxCameraObstructionFraction
  ) {
    return {
      status: 'outside-envelope',
      reason: 'observed-condition-outside-reviewed-envelope',
      cameraSemanticAllowed: false,
      fusionAllowed: false,
      qualificationClaim: false,
    };
  }

  const degraded = glareObserved || illuminanceLux < policy.minIlluminanceLux ||
    precipitationRateMmH > policy.maxPrecipitationRateMmH * 0.5 ||
    cameraObstructionFraction >= policy.maxCameraObstructionFraction * 0.5;
  if (degraded) {
    return {
      status: 'degraded',
      reason: 'observed-condition-requires-perception-degradation',
      cameraSemanticAllowed: false,
      fusionAllowed: false,
      qualificationClaim: false,
    };
  }

  return {
    status: 'nominal',
    reason: 'observed-condition-within-reviewed-envelope',
    cameraSemanticAllowed: true,
    fusionAllowed: true,
    qualificationClaim: false,
  };
}
