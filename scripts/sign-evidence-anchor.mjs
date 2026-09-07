import {readFileSync} from 'node:fs';
import {signEvidenceAnchor} from './evidence-signature-lib.mjs';

const anchorPath=(process.env.KINGMAST_EVIDENCE_ANCHOR_PATH??process.argv[2]??'').trim();
const privateKeyPem=(process.env.KINGMAST_EVIDENCE_SIGNING_PRIVATE_KEY_PEM??'').trim();
const keyId=(process.env.KINGMAST_EVIDENCE_SIGNING_KEY_ID??'').trim();
if(!anchorPath)throw new Error('KINGMAST_EVIDENCE_ANCHOR_PATH or argv[2] is required');
if(!privateKeyPem)throw new Error('KINGMAST_EVIDENCE_SIGNING_PRIVATE_KEY_PEM is required and must be supplied out-of-repository');
if(!keyId)throw new Error('KINGMAST_EVIDENCE_SIGNING_KEY_ID is required');
const anchor=JSON.parse(readFileSync(anchorPath,'utf8'));
const envelope=signEvidenceAnchor(anchor,{privateKeyPem,keyId,signedAt:process.env.KINGMAST_EVIDENCE_SIGNED_AT||new Date().toISOString()});
process.stdout.write(`${JSON.stringify(envelope,null,2)}\n`);
