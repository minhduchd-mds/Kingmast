import {describe,expect,it} from 'vitest';
import {buildPerceptionEvidenceManifest,validatePerceptionEvidenceManifestInput} from './perception-evidence-manifest.js';

const base={buildCommit:'a'.repeat(40),modelArtifactSha256:'b'.repeat(64),calibrationRef:'calibration:front-camera-01',timeSyncRef:'timesync:bench-01',datasetRefs:['dataset:urban-day-v1'],evaluationRefs:['eval:night-rain-v1']};

describe('perception evidence manifest',()=>{
  it('binds software evidence without claiming physical qualification',()=>{
    const manifest=buildPerceptionEvidenceManifest(base,'2026-09-12T00:00:00.000Z');
    expect(manifest.schema).toBe('kingmast-perception-evidence-manifest/v1');
    expect(manifest.targetHardwareQualified).toBe(false);
    expect(manifest.physicalHilExecuted).toBe(false);
    expect(manifest.controlAuthority).toBe('none');
  });

  it('keeps sensitive raw data excluded by default',()=>{
    const manifest=buildPerceptionEvidenceManifest(base);
    expect(Object.values(manifest.privacy).every((value)=>value===false)).toBe(true);
  });

  it('rejects missing lineage or invalid hashes',()=>{
    expect(validatePerceptionEvidenceManifestInput({...base,modelArtifactSha256:'bad'}).valid).toBe(false);
    expect(validatePerceptionEvidenceManifestInput({...base,datasetRefs:[]}).reasons).toContain('dataset-evidence-missing');
    expect(validatePerceptionEvidenceManifestInput({...base,timeSyncRef:''}).reasons).toContain('time-sync-ref-missing');
  });

  it('fails construction instead of emitting an incomplete evidence package',()=>{
    expect(()=>buildPerceptionEvidenceManifest({...base,evaluationRefs:[]})).toThrow(/invalid perception evidence manifest/);
  });
});
