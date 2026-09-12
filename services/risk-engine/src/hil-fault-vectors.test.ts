import {describe,expect,it} from 'vitest';
import {HIL_FAULT_VECTORS,validateHilFaultVectorRegistry} from './hil-fault-vectors.js';

describe('HIL software fault-vector registry',()=>{
  it('keeps deterministic software preflight distinct from physical HIL',()=>{
    const result=validateHilFaultVectorRegistry();
    expect(result.valid).toBe(true);
    expect(result.physicalHilExecuted).toBe(false);
    expect(result.targetHardwareQualified).toBe(false);
    expect(result.controlAuthority).toBe('none');
  });

  it('covers temporal, sensor, positioning, replay and disagreement faults',()=>{
    expect(HIL_FAULT_VECTORS.length).toBeGreaterThanOrEqual(8);
    expect(HIL_FAULT_VECTORS.map((item)=>item.id)).toEqual(expect.arrayContaining(['HFV-001','HFV-002','HFV-003','HFV-004','HFV-005','HFV-006','HFV-007','HFV-008']));
    expect(HIL_FAULT_VECTORS.every((item)=>item.physicalScenarioSatisfied===false&&item.controlAuthority==='none')).toBe(true);
  });

  it('rejects duplicate identifiers',()=>{
    const duplicate=[HIL_FAULT_VECTORS[0]!,HIL_FAULT_VECTORS[0]!,...HIL_FAULT_VECTORS.slice(2)];
    const result=validateHilFaultVectorRegistry(duplicate);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((reason)=>reason.startsWith('duplicate-id:'))).toBe(true);
  });
});
