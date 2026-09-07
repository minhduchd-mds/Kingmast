import {readFileSync} from 'node:fs';
import {verifyExternalEvidenceTimestamp} from './evidence-timestamp-lib.mjs';

const anchorPath=(process.env.KINGMAST_EVIDENCE_ANCHOR_PATH??process.argv[2]??'').trim();
const attestationPath=(process.env.KINGMAST_EXTERNAL_TIMESTAMP_PATH??process.argv[3]??'').trim();
const authorityPublicKeyPem=(process.env.KINGMAST_EXTERNAL_TIMESTAMP_PUBLIC_KEY_PEM??'').trim();
if(!anchorPath||!attestationPath)throw new Error('anchor and external timestamp attestation paths are required');
if(!authorityPublicKeyPem)throw new Error('KINGMAST_EXTERNAL_TIMESTAMP_PUBLIC_KEY_PEM is required');
const anchor=JSON.parse(readFileSync(anchorPath,'utf8'));
const attestation=JSON.parse(readFileSync(attestationPath,'utf8'));
const result=verifyExternalEvidenceTimestamp(anchor,attestation,{authorityPublicKeyPem});
if(!result.verified)throw new Error(`external evidence timestamp verification failed: ${result.reason}`);
process.stdout.write(`${JSON.stringify(result)}\n`);
