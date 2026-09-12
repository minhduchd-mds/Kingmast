import {describe,expect,it} from 'vitest';
import {assessEnvironmentAssurance} from './environment-assurance.js';

const clear={observedAtMs:9_900,source:'vehicle-sensor' as const,visibility:'normal' as const,illumination:'normal' as const,precipitation:'none' as const,cameraObstructed:false};

describe('assessEnvironmentAssurance',()=>{
  it('does not fabricate weather when no fresh observation exists',()=>{
    const result=assessEnvironmentAssurance({nowMs:10_000,observation:null,maxObservationAgeMs:5_000});
    expect(result.observed).toBe(false);
    expect(result.state).toBe('unknown');
    expect(result.reasons).toContain('environment-not-observed');
  });

  it('keeps a fresh clear observation nominal',()=>{
    const result=assessEnvironmentAssurance({nowMs:10_000,observation:clear,maxObservationAgeMs:5_000});
    expect(result.state).toBe('nominal');
    expect(result.confidenceCeiling).toBe(1);
  });

  it('caps confidence for observed heavy rain, low visibility and glare',()=>{
    const result=assessEnvironmentAssurance({nowMs:10_000,observation:{...clear,visibility:'reduced',precipitation:'heavy-rain',illumination:'glare'},maxObservationAgeMs:5_000});
    expect(result.state).toBe('degraded');
    expect(result.confidenceCeiling).toBeLessThanOrEqual(0.65);
    expect(result.reasons).toEqual(expect.arrayContaining(['low-visibility-observed','heavy-precipitation-observed','glare-observed']));
  });

  it('blocks camera claims on observed obstruction while preserving radar geometry',()=>{
    const result=assessEnvironmentAssurance({nowMs:10_000,observation:{...clear,cameraObstructed:true},maxObservationAgeMs:5_000});
    expect(result.allowedClaims.cameraClassification).toBe(false);
    expect(result.allowedClaims.laneGeometry).toBe(false);
    expect(result.allowedClaims.radarGeometry).toBe(true);
  });

  it('does not reuse stale environment observations as current truth',()=>{
    const result=assessEnvironmentAssurance({nowMs:20_000,observation:clear,maxObservationAgeMs:5_000});
    expect(result.observed).toBe(false);
    expect(result.state).toBe('unknown');
    expect(result.reasons).toContain('environment-observation-stale');
  });
});
