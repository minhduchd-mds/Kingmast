import { describe,expect,it } from 'vitest';
import { runServiceFaultPreflight } from './service-fault-preflight.js';

describe('service fault preflight',()=>{
  it('passes the bounded deterministic software fault matrix without claiming physical HIL',()=>{
    const report=runServiceFaultPreflight();
    expect(report.schema).toBe('kingmast-service-fault-preflight-report/v1');
    expect(report.controlAuthority).toBe('none');
    expect(report.qualificationClaim).toBe('ci-service-fault-preflight-only-not-physical-hil');
    expect(report.validationLayer).toBe('L2-service-integration');
    expect(report.physicalHilExecuted).toBe(false);
    expect(report.physicalHilQualified).toBe(false);
    expect(report.targetHardwareQualified).toBe(false);
    expect(report.total).toBe(10);
    expect(report.failed).toBe(0);
    expect(report.allPassed).toBe(true);
    expect(report.cases.every((item)=>item.passed)).toBe(true);
    expect(report.cases.every((item)=>item.physicalScenarioSatisfied===false)).toBe(true);
    expect(report.relatedPhysicalScenarios).toEqual(expect.arrayContaining(['HIL-001','HIL-002','HIL-008','HIL-009']));
  });
});
