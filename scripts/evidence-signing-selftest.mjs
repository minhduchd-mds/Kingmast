import {generateKeyPairSync,sign as signSignature} from 'node:crypto';
import {signEvidenceAnchor,verifySignedEvidenceAnchor} from './evidence-signature-lib.mjs';
import {evidenceTimestampPayload,verifyExternalEvidenceTimestamp} from './evidence-timestamp-lib.mjs';

const pair=generateKeyPairSync('ed25519');
const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const anchor={schema:'kingmast-evidence-anchor/v1',sourceCommit:'a'.repeat(40),rootSha256:'b'.repeat(64)};
const envelope=signEvidenceAnchor(anchor,{privateKeyPem,keyId:'ci-ephemeral-selftest',signedAt:'2026-01-01T00:00:00.000Z'});
const ok=verifySignedEvidenceAnchor(anchor,envelope,{publicKeyPem});
if(!ok.verified)throw new Error('evidence signature self-test failed');
const tampered=verifySignedEvidenceAnchor({...anchor,rootSha256:'c'.repeat(64)},envelope,{publicKeyPem});
if(tampered.verified)throw new Error('evidence signature self-test failed to reject tampering');
if(envelope.externalTimestampAuthority!=='none'||envelope.nonRepudiationClaim!==false)throw new Error('evidence signature self-test weakened trust boundary');

const timestampPair=generateKeyPairSync('ed25519');
const timestampPublic=timestampPair.publicKey.export({type:'spki',format:'pem'}).toString();
const attestation={schema:'kingmast-external-evidence-timestamp/v1',algorithm:'ed25519',authorityId:'ci-ephemeral-timestamp-selftest',sourceCommit:anchor.sourceCommit,rootSha256:anchor.rootSha256,observedAt:'2026-01-01T00:00:30.000Z',signatureBase64:''};
attestation.signatureBase64=signSignature(null,evidenceTimestampPayload(attestation),timestampPair.privateKey).toString('base64');
const timestampResult=verifyExternalEvidenceTimestamp(anchor,attestation,{authorityPublicKeyPem:timestampPublic,nowMs:Date.parse('2026-01-01T00:01:00.000Z')});
if(!timestampResult.verified)throw new Error('external evidence timestamp self-test failed');
const timestampTamper=verifyExternalEvidenceTimestamp({...anchor,rootSha256:'c'.repeat(64)},attestation,{authorityPublicKeyPem:timestampPublic,nowMs:Date.parse('2026-01-01T00:01:00.000Z')});
if(timestampTamper.verified)throw new Error('external evidence timestamp self-test failed to reject tampering');
console.log('KINGMAST evidence signing/timestamp self-test passed with ephemeral CI-only Ed25519 keys.');
