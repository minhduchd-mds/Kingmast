import {resolve} from 'node:path';
import {readJsonBytes,validatePhysicalEvidenceManifest} from './lib/physical-evidence-manifest.mjs';

const kind=(process.env.KINGMAST_PHYSICAL_EVIDENCE_KIND??'').trim();
const packagePath=resolve(process.env.KINGMAST_PHYSICAL_PACKAGE_PATH??'');
const manifestPath=resolve(process.env.KINGMAST_PHYSICAL_MANIFEST_PATH??'');
const expectedSourceCommit=(process.env.KINGMAST_EXPECTED_SOURCE_COMMIT??'').trim();
if(!process.env.KINGMAST_PHYSICAL_PACKAGE_PATH||!process.env.KINGMAST_PHYSICAL_MANIFEST_PATH)throw new Error('physical package and manifest paths are required');
const packageData=readJsonBytes(packagePath);
const manifestData=readJsonBytes(manifestPath);
validatePhysicalEvidenceManifest(manifestData.payload,{kind,packagePayload:packageData.payload,packageBytes:packageData.bytes,expectedSourceCommit});
console.log(`KINGMAST physical evidence manifest valid: kind=${kind}; scenario=${manifestData.payload.scenarioId}; packageSha256=${manifestData.payload.packageSha256}; independent-review-required=true`);
