import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

function sha256File(path){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function listFiles(path){
  const root=resolve(path);
  const files=[];
  function walk(current){
    const stat=lstatSync(current);
    if(stat.isSymbolicLink())throw new Error(`provenance build path must not contain symlinks: ${current}`);
    if(stat.isFile()){files.push(current);return;}
    if(!stat.isDirectory())throw new Error(`unsupported provenance path type: ${current}`);
    for(const entry of readdirSync(current).sort())walk(join(current,entry));
  }
  walk(root);
  return{root,files};
}
function digestMaterial(path){
  if(!existsSync(path))throw new Error(`provenance material does not exist: ${path}`);
  const stat=lstatSync(path);
  if(stat.isSymbolicLink())throw new Error(`provenance material must not be a symlink: ${path}`);
  if(stat.isFile())return{name:path,kind:'file',fileCount:1,sha256:sha256File(path)};
  const{root,files}=listFiles(path);
  const hash=createHash('sha256');
  for(const file of files){
    const name=relative(root,file).replaceAll('\\','/');
    hash.update(name);hash.update('\0');hash.update(readFileSync(file));hash.update('\0');
  }
  return{name:path,kind:'tree',fileCount:files.length,sha256:hash.digest('hex')};
}

const pkg=JSON.parse(readFileSync('package.json','utf8'));
const lockfile='pnpm-lock.yaml';
const sbomPath=(process.env.KINGMAST_SBOM_PATH??'').trim();
const buildPaths=(process.env.KINGMAST_BUILD_PATHS??'').split(',').map((item)=>item.trim()).filter(Boolean);
if(!existsSync(lockfile))throw new Error('pnpm-lock.yaml is required for provenance');
if(sbomPath&&!existsSync(sbomPath))throw new Error(`SBOM path does not exist: ${sbomPath}`);

const commit=(process.env.GITHUB_SHA??process.env.KINGMAST_SOURCE_COMMIT??'local-unknown').trim();
const repository=(process.env.GITHUB_REPOSITORY??'minhduchd-mds/Kingmast').trim();
const ref=(process.env.GITHUB_REF??'local').trim();
const runId=(process.env.GITHUB_RUN_ID??'local').trim();
const workflow=(process.env.GITHUB_WORKFLOW??'local').trim();
const provenance={
  schema:'kingmast-build-provenance/v1',
  subject:{name:pkg.name??'kingmast',version:pkg.version??'0.0.0',repository,commit,ref},
  build:{packageManager:pkg.packageManager??null,nodeVersion:process.version,runId,workflow,warningOnlyAuthority:true},
  materials:[
    {name:'pnpm-lock.yaml',kind:'file',fileCount:1,sha256:sha256File(lockfile)},
    ...(sbomPath?[{name:'cyclonedx-sbom',kind:'file',fileCount:1,sha256:sha256File(sbomPath)}]:[]),
    ...buildPaths.map(digestMaterial),
  ],
  assertions:{
    reproducibleInstallRequired:true,
    actuatorAuthority:'none',
    rawVehicleControlArtifacts:false,
    generatedBy:'scripts/generate-build-provenance.mjs',
  },
};
process.stdout.write(`${JSON.stringify(provenance,null,2)}\n`);
