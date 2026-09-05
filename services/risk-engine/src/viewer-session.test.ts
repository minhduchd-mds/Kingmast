import { describe,expect,it } from 'vitest';
import { issueViewerSession,readViewerSession,verifyViewerSession,VIEWER_SESSION_SCOPE,VIEWER_SESSION_TTL_S } from '@kingmast/contracts/viewer-session';

const secret='viewer-secret-for-kingmast-tests';
const now=1_788_624_600_000;

describe('scoped viewer session',()=>{
  it('issues a short-lived read-only token without embedding the shared secret',()=>{
    const token=issueViewerSession(secret,now);
    const claims=readViewerSession(token,secret,now);
    expect(token).toContain(`.${VIEWER_SESSION_SCOPE}.`);
    expect(token).not.toContain(secret);
    expect(claims?.scope).toBe(VIEWER_SESSION_SCOPE);
    expect(claims?.expiresAtMs).toBe(now+VIEWER_SESSION_TTL_S*1000);
    expect(verifyViewerSession(token,secret,now)).toBe(true);
  });

  it('rejects tampered and wrong-secret tokens',()=>{
    const token=issueViewerSession(secret,now);
    expect(readViewerSession(`${token.slice(0,-1)}x`,secret,now)).toBeNull();
    expect(verifyViewerSession(token,'different-viewer-secret-for-tests',now)).toBe(false);
  });

  it('expires after the fixed session TTL and clock-skew allowance',()=>{
    const token=issueViewerSession(secret,now);
    const expiredAt=now+(VIEWER_SESSION_TTL_S+31)*1000;
    expect(readViewerSession(token,secret,expiredAt)).toBeNull();
  });

  it('rejects a token issued too far in the future',()=>{
    const token=issueViewerSession(secret,now+31_000);
    expect(verifyViewerSession(token,secret,now)).toBe(false);
  });
});
