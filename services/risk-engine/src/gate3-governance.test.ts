import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repoRoot=resolve(process.cwd(),'../..');
function readJson(path:string){return JSON.parse(readFileSync(resolve(repoRoot,path),'utf8')) as Record<string,any>;}
function read(path:string){return readFileSync(resolve(repoRoot,path),'utf8');}

describe('Gate-3 physical evidence governance',()=>{
  it('keeps HIL execution physical, independently reviewed and non-qualifying',()=>{
    const manifest=readJson('docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json');
    expect(manifest.schema).toBe('kingmast-hil-execution-manifest/v1');
    expect(manifest.controlAuthority).toBe('none');
    expect(manifest.physicalExecutionRequired).toBe(true);
    expect(manifest.automaticQualification).toBe(false);
    expect(manifest.scenarios).toHaveLength(12);
    expect(new Set(manifest.scenarios.map((scenario:any)=>scenario.id)).size).toBe(12);
    expect(manifest.promotionRule.registryMutationByWorkflow).toBe(false);
    expect(manifest.promotionRule.passRequiresIndependentReviewer).toBe(true);
    expect(manifest.promotionRule.targetHardwareQualified).toBe(false);
    expect(manifest.promotionRule.publicRoadApproved).toBe(false);
  });

  it('keeps controlled-track execution blocked until physical prerequisites exist',()=>{
    const registry=readJson('docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json');
    expect(registry.schema).toBe('kingmast-closed-track-evidence-registry/v1');
    expect(registry.controlAuthority).toBe('none');
    expect(registry.status).toBe('blocked-pending-physical-prerequisites');
    expect(registry.closedTrackApproved).toBe(false);
    expect(registry.targetHardwareQualified).toBe(false);
    expect(registry.publicRoadApproved).toBe(false);
    expect(Object.values(registry.prerequisites).every((value)=>value===false)).toBe(true);
    expect(registry.scenarios.length).toBeGreaterThanOrEqual(8);
    expect(registry.scenarios.every((scenario:any)=>scenario.status==='pending'&&scenario.evidence===null)).toBe(true);
  });

  it('keeps independent review bookkeeping pending without invented reviewers',()=>{
    const registry=readJson('docs/review/V006_INDEPENDENT_REVIEW_REGISTRY.json');
    expect(registry.schema).toBe('kingmast-independent-review-registry/v1');
    expect(registry.overallStatus).toBe('pending');
    expect(registry.targetHardwareQualified).toBe(false);
    expect(registry.closedTrackApproved).toBe(false);
    expect(registry.publicRoadApproved).toBe(false);
    expect(registry.reviews.length).toBeGreaterThanOrEqual(5);
    expect(registry.reviews.every((review:any)=>review.status==='pending'&&review.reviewer===null&&review.disposition===null)).toBe(true);
  });

  it('keeps physical HIL workflow guarded and unable to mutate qualification truth',()=>{
    const workflow=read('.github/workflows/hil-physical-evidence.yml');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('self-hosted, linux, kingmast-hil');
    expect(workflow).toContain('environment: hil-physical-evidence');
    expect(workflow).toContain('acknowledge_physical_evidence_only');
    expect(workflow).toContain('captured-awaiting-independent-review');
    expect(workflow).not.toContain('targetHardwareQualified: true');
    expect(workflow).not.toContain('publicRoadApproved: true');
  });

  it('keeps executable honesty validators present for future physical promotion',()=>{
    expect(read('scripts/hil-execution-manifest-check.mjs')).toContain('automaticQualification');
    expect(read('scripts/hil-physical-capture-package.mjs')).toContain('physicalControllerTest=true is required');
    expect(read('scripts/closed-track-evidence-check.mjs')).toContain('publicRoadApproved must remain false');
    expect(read('scripts/independent-review-registry-check.mjs')).toContain('publicRoadApproved');
  });
});
