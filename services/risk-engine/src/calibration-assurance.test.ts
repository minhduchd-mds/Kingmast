import {describe,expect,it} from 'vitest';
import {assessCalibrationAssurance} from './calibration-assurance.js';

const base={
  nowMs:10_000,
  capturedAtMs:9_500,
  maxAgeMs:10_000,
  sensorId:'front-radar',
  calibrationRevision:'cal-2026-09',
  configurationRevision:'cfg-2026-09',
  artifactSha256:'b'.repeat(64),
  mountRevision:'mount-a',
  expectedMountRevision:'mount-a',
  review:'accepted' as const,
};

describe('assessCalibrationAssurance',()=>{
  it('verifies only a reviewed, fresh, mount-consistent calibration artifact',()=>{
    const result=assessCalibrationAssurance(base);
    expect(result.state).toBe('verified');
    expect(result.usableForResearchClaims).toBe(true);
    expect(result.controlAuthority).toBe('none');
  });

  it('keeps pending independent review unknown',()=>{
    const result=assessCalibrationAssurance({...base,review:'pending'});
    expect(result.state).toBe('unknown');
    expect(result.usableForResearchClaims).toBe(false);
  });

  it('invalidates a mounting change until recalibration is reviewed',()=>{
    const result=assessCalibrationAssurance({...base,mountRevision:'mount-b'});
    expect(result.state).toBe('invalid');
    expect(result.reasons).toContain('mount-revision-mismatch');
  });

  it('invalidates stale or malformed evidence',()=>{
    expect(assessCalibrationAssurance({...base,capturedAtMs:-1,maxAgeMs:100}).state).toBe('invalid');
    expect(assessCalibrationAssurance({...base,artifactSha256:'bad'}).reasons).toContain('calibration-artifact-hash-invalid');
  });

  it('does not treat an independently rejected calibration as usable',()=>{
    const result=assessCalibrationAssurance({...base,review:'rejected'});
    expect(result.state).toBe('invalid');
    expect(result.usableForResearchClaims).toBe(false);
  });
});
