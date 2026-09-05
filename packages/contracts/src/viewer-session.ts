import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const VIEWER_SESSION_COOKIE='kingmast_viewer_session';
export const VIEWER_SESSION_SCOPE='viewer:read';
export const VIEWER_SESSION_TTL_S=10*60;

const VIEWER_SESSION_VERSION='v1';
const VIEWER_SESSION_CLOCK_SKEW_S=30;
const MIN_SECRET_LENGTH=16;

export interface ViewerSessionClaims {
  scope:typeof VIEWER_SESSION_SCOPE;
  issuedAtMs:number;
  expiresAtMs:number;
}

function assertSecret(secret:string){
  if(secret.length<MIN_SECRET_LENGTH)throw new Error('KINGMAST_VIEWER_TOKEN must be at least 16 characters');
}

function sign(secret:string,payload:string){
  return createHmac('sha256',secret).update(payload).digest('base64url');
}

function constantTimeEqual(left:string,right:string){
  const a=Buffer.from(left);
  const b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}

export function issueViewerSession(secret:string,nowMs=Date.now()):string {
  assertSecret(secret);
  const issuedAtS=Math.floor(nowMs/1000);
  const expiresAtS=issuedAtS+VIEWER_SESSION_TTL_S;
  const nonce=randomBytes(18).toString('base64url');
  const payload=[VIEWER_SESSION_VERSION,VIEWER_SESSION_SCOPE,issuedAtS,expiresAtS,nonce].join('.');
  return `${payload}.${sign(secret,payload)}`;
}

export function readViewerSession(token:string,secret:string,nowMs=Date.now()):ViewerSessionClaims|null {
  if(secret.length<MIN_SECRET_LENGTH||!token)return null;
  const parts=token.split('.');
  if(parts.length!==6)return null;
  const[version,scope,issuedAtRaw,expiresAtRaw,nonce,signature]=parts;
  if(version!==VIEWER_SESSION_VERSION||scope!==VIEWER_SESSION_SCOPE||!nonce||!signature)return null;
  if(!/^[A-Za-z0-9_-]{20,64}$/.test(nonce)||!/^[A-Za-z0-9_-]{32,64}$/.test(signature))return null;

  const issuedAtS=Number(issuedAtRaw);
  const expiresAtS=Number(expiresAtRaw);
  if(!Number.isSafeInteger(issuedAtS)||!Number.isSafeInteger(expiresAtS))return null;
  if(expiresAtS<=issuedAtS||expiresAtS-issuedAtS!==VIEWER_SESSION_TTL_S)return null;

  const nowS=Math.floor(nowMs/1000);
  if(issuedAtS>nowS+VIEWER_SESSION_CLOCK_SKEW_S)return null;
  if(expiresAtS<nowS-VIEWER_SESSION_CLOCK_SKEW_S)return null;

  const payload=[version,scope,issuedAtRaw,expiresAtRaw,nonce].join('.');
  if(!constantTimeEqual(signature,sign(secret,payload)))return null;
  return{scope:VIEWER_SESSION_SCOPE,issuedAtMs:issuedAtS*1000,expiresAtMs:expiresAtS*1000};
}

export function verifyViewerSession(token:string,secret:string,nowMs=Date.now()):boolean {
  return readViewerSession(token,secret,nowMs)!==null;
}
