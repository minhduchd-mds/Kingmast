import {generateKeyPairSync} from 'node:crypto';
import {signEvidenceAnchor,verifySignedEvidenceAnchor} from './evidence-signature-lib.mjs';

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
console.log('KINGMAST evidence signature self-test passed with ephemeral CI-only Ed25519 key.');
