import {createPublicKey,verify as verifySignature} from 'node:crypto';

const BASE64_RE=/^[A-Za-z0-9+/]+={0,2}$/;
const AUTHORITY_ID_RE=/^[A-Za-z0-9._:-]{1,128}$/;

export function evidenceTimestampPayload(attestation){
  if(!attestation||attestation.schema!=='kingmast-external-evidence-timestamp/v1')throw new Error('invalid external evidence timestamp schema');
  if(!AUTHORITY_ID_RE.test(attestation.authorityId??''))throw new Error('invalid timestamp authority id');
  if(!/^[a-f0-9]{40}$/i.test(attestation.sourceCommit??''))throw new Error('timestamp attestation requires a full source commit');
  if(!/^[a-f0-9]{64}$/i.test(attestation.rootSha256??''))throw new Error('timestamp attestation requires a SHA-256 root');
  if(typeof attestation.observedAt!=='string'||Number.isNaN(Date.parse(attestation.observedAt)))throw new Error('timestamp attestation requires RFC3339 observedAt');
  return Buffer.from(`KINGMAST-EVIDENCE-TIMESTAMP-V1\n${attestation.authorityId}\n${attestation.sourceCommit}\n${attestation.rootSha256}\n${attestation.observedAt}`,'utf8');
}

export function verifyExternalEvidenceTimestamp(anchor,attestation,{authorityPublicKeyPem,nowMs=Date.now(),maxFutureSkewMs=300_000}){
  if(!anchor||anchor.schema!=='kingmast-evidence-anchor/v1')return{verified:false,reason:'invalid-anchor'};
  try{evidenceTimestampPayload(attestation);}catch{return{verified:false,reason:'invalid-attestation'};}
  if(attestation.sourceCommit!==anchor.sourceCommit||attestation.rootSha256!==anchor.rootSha256)return{verified:false,reason:'anchor-binding-mismatch'};
  const observedMs=Date.parse(attestation.observedAt);
  if(observedMs>nowMs+maxFutureSkewMs)return{verified:false,reason:'timestamp-from-future'};
  if(attestation.algorithm!=='ed25519'||typeof attestation.signatureBase64!=='string'||attestation.signatureBase64.length>256||!BASE64_RE.test(attestation.signatureBase64))return{verified:false,reason:'invalid-signature'};
  let signature;try{signature=Buffer.from(attestation.signatureBase64,'base64');}catch{return{verified:false,reason:'invalid-signature'};}
  if(signature.length!==64||signature.toString('base64')!==attestation.signatureBase64)return{verified:false,reason:'invalid-signature'};
  let publicKey;try{publicKey=createPublicKey(authorityPublicKeyPem);if(publicKey.asymmetricKeyType!=='ed25519')return{verified:false,reason:'invalid-authority-key'};}catch{return{verified:false,reason:'invalid-authority-key'};}
  let verified=false;try{verified=verifySignature(null,evidenceTimestampPayload(attestation),publicKey,signature);}catch{verified=false;}
  if(!verified)return{verified:false,reason:'signature-invalid'};
  return{verified:true,authorityId:attestation.authorityId,observedAt:attestation.observedAt,sourceCommit:anchor.sourceCommit,rootSha256:anchor.rootSha256};
}
