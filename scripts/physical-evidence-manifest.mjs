import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildPhysicalEvidenceManifest,readJsonBytes} from './lib/physical-evidence-manifest.mjs';

const kind=(process.env.KINGMAST_PHYSICAL_EVIDENCE_KIND??'').trim();
const packagePath=resolve(process.env.KINGMAST_PHYSICAL_PACKAGE_PATH??'');
const manifestPath=resolve(process.env.KINGMAST_PHYSICAL_MANIFEST_PATH??'');
const expectedSourceCommit=(process.env.KINGMAST_EXPECTED_SOURCE_COMMIT??'').trim();
const workflowName=(process.env.GITHUB_WORKFLOW??'local-physical-evidence-packaging').trim();
const runId=(process.env.GITHUB_RUN_ID??'0').trim();
const runAttempt=(process.env.GITHUB_RUN_ATTEMPT??'0').trim();

if(!process.env.KINGMAST_PHYSICAL_PACKAGE_PATH)throw new Error('KINGMAST_PHYSICAL_PACKAGE_PATH is required');
if(!process.env.KINGMAST_PHYSICAL_MANIFEST_PATH)throw new Error('KINGMAST_PHYSICAL_MANIFEST_PATH is required');
const {bytes,payload}=readJsonBytes(packagePath);
const manifest=buildPhysicalEvidenceManifest({kind,packagePayload:payload,packageBytes:bytes,expectedSourceCommit,workflowName,runId,runAttempt});
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`KINGMAST physical evidence manifest created: kind=${kind}; scenario=${manifest.scenarioId}; source=${manifest.sourceCommit}; review=pending; qualification=false`);
