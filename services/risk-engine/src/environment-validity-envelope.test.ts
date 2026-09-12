import { describe, expect, it } from 'vitest';
import { assessEnvironmentValidityEnvelope } from './environment-validity-envelope.js';

const policy = {
  reviewed: true,
  maxAgeMs: 1_000,
  minVisibilityM: 80,
  minIlluminanceLux: 20,
  maxPrecipitationRateMmH: 20,
  maxCameraObstructionFraction: 0.6,
};
const nominal = {
  observedAtMs: 1_000,
  visibilityM: 300,
  illuminanceLux: 500,
  precipitationRateMmH: 0,
  glareObserved: false,
  cameraObstructionFraction: 0.05,
};

describe('environment validity envelope', () => {
  it('allows semantic fusion only for fresh observations inside a reviewed envelope', () => {
    expect(assessEnvironmentValidityEnvelope(nominal, 1_100, policy)).toMatchObject({
      status: 'nominal', cameraSemanticAllowed: true, fusionAllowed: true, qualificationClaim: false,
    });
  });

  it('fails closed when required environment evidence is missing', () => {
    expect(assessEnvironmentValidityEnvelope({ ...nominal, visibilityM: null }, 1_100, policy)).toMatchObject({
      status: 'unavailable', cameraSemanticAllowed: false, fusionAllowed: false,
    });
  });

  it('blocks perception claims outside the reviewed envelope', () => {
    expect(assessEnvironmentValidityEnvelope({ ...nominal, visibilityM: 30 }, 1_100, policy)).toMatchObject({
      status: 'outside-envelope', reason: 'observed-condition-outside-reviewed-envelope', fusionAllowed: false,
    });
  });

  it('degrades glare without inventing nominal camera confidence', () => {
    expect(assessEnvironmentValidityEnvelope({ ...nominal, glareObserved: true }, 1_100, policy)).toMatchObject({
      status: 'degraded', cameraSemanticAllowed: false, fusionAllowed: false,
    });
  });

  it('does not treat an unreviewed threshold set as a validated envelope', () => {
    expect(assessEnvironmentValidityEnvelope(nominal, 1_100, { ...policy, reviewed: false })).toMatchObject({
      status: 'unavailable', reason: 'unreviewed-or-invalid-envelope-policy', qualificationClaim: false,
    });
  });
});
