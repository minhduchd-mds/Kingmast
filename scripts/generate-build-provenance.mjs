import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';

function sha256File(path){return createHash('sha256').update(readFileSync(path)).digest('hex');}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const lockfile='pnpm-lock.yaml';
const sbomPath=(process.env.KINGMAST_SBOM_PATH??'').trim();
if(!existsSync(lockfile))throw new Error('pnpm-lock.yaml is required for provenance');
if(sbomPath&&!existsSync(sbomPath))throw new Error(`SBOM path does not exist: ${sbomPath}`);

const commit=(process.env.GITHUB_SHA??process.env.KINGMAST_SOURCE_COMMIT??'local-unknown').trim();
const repository=(process.env.GITHUB_REPOSITORY??'minhduchd-mds/Kingmast').trim();
const ref=(process.env.GITHUB_REF??'local').trim();
const runId=(process.env.GITHUB_RUN_ID??'local').trim();
const provenance={
  schema:'kingmast-build-provenance/v1',
  subject:{
    name:pkg.name??'kingmast',
    version:pkg.version??'0.0.0',
    repository,
    commit,
    ref,
  },
  build:{
    packageManager:pkg.packageManager??null,
    nodeVersion:process.version,
    runId,
    warningOnlyAuthority:true,
  },
  materials:[
    {name:'pnpm-lock.yaml',sha256:sha256File(lockfile)},
    ...(sbomPath?[{name:'cyclonedx-sbom',sha256:sha256File(sbomPath)}]:[]),
  ],
  assertions:{
    reproducibleInstallRequired:true,
    actuatorAuthority:'none',
    generatedBy:'scripts/generate-build-provenance.mjs',
  },
};
process.stdout.write(`${JSON.stringify(provenance,null,2)}\n`);
