import {readFileSync} from 'node:fs';
import {verifySignedEvidenceAnchor} from './evidence-signature-lib.mjs';

const anchorPath=(process.env.KINGMAST_EVIDENCE_ANCHOR_PATH??process.argv[2]??'').trim();
const envelopePath=(process.env.KINGMAST_SIGNED_EVIDENCE_PATH??process.argv[3]??'').trim();
const publicKeyPem=(process.env.KINGMAST_EVIDENCE_SIGNING_PUBLIC_KEY_PEM??'').trim();
if(!anchorPath||!envelopePath)throw new Error('anchor and signed-envelope paths are required');
if(!publicKeyPem)throw new Error('KINGMAST_EVIDENCE_SIGNING_PUBLIC_KEY_PEM is required');
const anchor=JSON.parse(readFileSync(anchorPath,'utf8'));
const envelope=JSON.parse(readFileSync(envelopePath,'utf8'));
const result=verifySignedEvidenceAnchor(anchor,envelope,{publicKeyPem});
if(!result.verified)throw new Error(`signed evidence verification failed: ${result.reason}`);
process.stdout.write(`${JSON.stringify(result)}\n`);
