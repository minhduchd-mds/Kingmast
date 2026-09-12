import{describe,expect,it}from'vitest';
import{decideEvidenceRetention}from'./evidence-retention-policy.js';
const policy={nowMs:10000,diagnosticMaxAgeMs:1000,safetySummaryMaxAgeMs:10000,rawSensorMaxAgeMs:500,rawSensorRetentionReviewed:false};
const base={id:'e1',class:'safety-summary' as const,createdAtMs:9000,containsPreciseLocation:false,containsRawImage:false,containsHardwareSerial:false};
describe('evidence retention policy',()=>{
  it('retains bounded summary evidence',()=>expect(decideEvidenceRetention(base,policy)).toMatchObject({retain:true,reason:'within-reviewed-retention'}));
  it('expires old evidence',()=>expect(decideEvidenceRetention({...base,class:'diagnostic',createdAtMs:8000},policy).reason).toBe('retention-expired'));
  it('blocks unreviewed raw-sensor retention',()=>expect(decideEvidenceRetention({...base,class:'raw-sensor',createdAtMs:9800},policy).reason).toBe('raw-retention-unreviewed'));
  it('returns required privacy redactions',()=>expect(decideEvidenceRetention({...base,containsPreciseLocation:true,containsRawImage:true,containsHardwareSerial:true},policy).redactions).toEqual(['precise-location','raw-image','hardware-serial']));
});
