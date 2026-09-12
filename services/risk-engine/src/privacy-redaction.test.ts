import{describe,expect,it}from'vitest';
import{containsForbiddenExportKey,redactEvidenceForExport}from'./privacy-redaction.js';

describe('privacy redaction',()=>{
  it('removes precise location, raw images, hardware serials and driver identity from export shape',()=>{
    const result=redactEvidenceForExport({eventId:'e1',timestampMs:1000,preciseLocation:{lat:21.02,lng:105.8},rawImageRef:'frame.jpg',hardwareSerial:'ABC123',driverId:'driver-1',summary:'sensor degraded'});
    expect(result?.redactedFields).toEqual(['preciseLocation','rawImageRef','hardwareSerial','driverId']);
    expect(containsForbiddenExportKey(result)).toBe(false);
  });
  it('keeps only bounded non-sensitive evidence',()=>expect(redactEvidenceForExport({eventId:'e2',timestampMs:1000,summary:'warning cleared'})).toEqual({eventId:'e2',timestampMs:1000,summary:'warning cleared',locationRegion:'absent',redactedFields:[]}));
  it('rejects malformed location evidence instead of exporting it',()=>expect(redactEvidenceForExport({eventId:'e3',timestampMs:1000,summary:'x',preciseLocation:{lat:Number.NaN,lng:1}})).toBeNull());
  it('detects forbidden nested export keys',()=>expect(containsForbiddenExportKey({safe:{token:'should-not-export'}})).toBe(true));
});
