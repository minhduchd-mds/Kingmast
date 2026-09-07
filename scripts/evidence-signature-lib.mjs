import {createPrivateKey,createPublicKey,sign as signSignature,timingSafeEqual,verify as verifySignature} from 'node:crypto';

const BASE64_RE=/^[A-Za-z0-9+/]+={0,2}$/;
const KEY_ID_RE=/^[A-Za-z0-9._:-]{1,128}$/;

export function evidenceSignaturePayload(anchor){
  if(!anchor||anchor.schema!=='kingmast-evidence-anchor/v1')throw new Error('invalid KINGMAST evidence anchor');
  if(!/^[a-f0-9]{40}$/i.test(anchor.sourceCommit??''))throw new Error('evidence anchor requires a full source commit');
  if(!/^[a-f0-9]{64}$/i.test(anchor.rootSha256??''))throw new Error('evidence anchor requires a SHA-256 root');
  return Buffer.from(`KINGMAST-EVIDENCE-SIGNATURE-V1\n${anchor.sourceCommit}\n${anchor.rootSha256}`,'utf8');
}

function assertKeyId(keyId){if(!KEY_ID_RE.test(keyId))throw new Error('invalid evidence signing key id');}
function assertEd25519PrivateKey(privateKeyPem){const key=createPrivateKey(privateKeyPem);if(key.asymmetricKeyType!=='ed25519')throw new Error('evidence signing key must be Ed25519');return key;}
function assertEd25519PublicKey(publicKeyPem){const key=createPublicKey(publicKeyPem);if(key.asymmetricKeyType!=='ed25519')throw new Error('evidence verification key must be Ed25519');return key;}

export function signEvidenceAnchor(anchor,{privateKeyPem,keyId,signedAt=new Date().toISOString()}){
  assertKeyId(keyId);
  if(Number.isNaN(Date.parse(signedAt)))throw new Error('signedAt must be an RFC3339 timestamp');
  const privateKey=assertEd25519PrivateKey(privateKeyPem);
  const signature=signSignature(null,evidenceSignaturePayload(anchor),privateKey).toString('base64');
  return{
    schema:'kingmast-signed-evidence-anchor/v1',
    algorithm:'ed25519',
    keyId,
    sourceCommit:anchor.sourceCommit,
    rootSha256:anchor.rootSha256,
    signedAt,
    externalTimestampAuthority:'none',
    nonRepudiationClaim:false,
    signatureBase64:signature,
  };
}

export function verifySignedEvidenceAnchor(anchor,envelope,{publicKeyPem}){
  if(!envelope||envelope.schema!=='kingmast-signed-evidence-anchor/v1'||envelope.algorithm!=='ed25519')return{verified:false,reason:'invalid-envelope'};
  if(envelope.sourceCommit!==anchor.sourceCommit||envelope.rootSha256!==anchor.rootSha256)return{verified:false,reason:'anchor-binding-mismatch'};
  if(typeof envelope.signatureBase64!=='string'||envelope.signatureBase64.length>256||!BASE64_RE.test(envelope.signatureBase64))return{verified:false,reason:'invalid-signature-encoding'};
  let signature;
  try{signature=Buffer.from(envelope.signatureBase64,'base64');}catch{return{verified:false,reason:'invalid-signature-encoding'};}
  if(signature.length!==64||signature.toString('base64')!==envelope.signatureBase64)return{verified:false,reason:'invalid-signature-encoding'};
  let publicKey;
  try{publicKey=assertEd25519PublicKey(publicKeyPem);}catch{return{verified:false,reason:'invalid-public-key'};}
  let verified=false;
  try{verified=verifySignature(null,evidenceSignaturePayload(anchor),publicKey,signature);}catch{verified=false;}
  if(!verified)return{verified:false,reason:'signature-invalid'};
  const expectedCommit=Buffer.from(anchor.sourceCommit.toLowerCase(),'utf8');
  const actualCommit=Buffer.from(envelope.sourceCommit.toLowerCase(),'utf8');
  if(expectedCommit.length!==actualCommit.length||!timingSafeEqual(expectedCommit,actualCommit))return{verified:false,reason:'anchor-binding-mismatch'};
  return{verified:true,keyId:envelope.keyId,sourceCommit:anchor.sourceCommit,rootSha256:anchor.rootSha256};
}
