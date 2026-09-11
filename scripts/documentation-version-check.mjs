import { existsSync,readdirSync,readFileSync,statSync } from 'node:fs';
import { basename,join,resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const current='0.0.8';
const previous='0.0.7';
const documentationRoots=['README.md','docs','safety'];
const activeCodeRoots=['apps','services','packages','edge','.github'];
const documentationFiles=[];
const activeCodeFiles=[];
const textExtensions=/\.(?:md|mjs|js|ts|tsx|json|css|py|ya?ml)$/i;
const generatedDirectories=new Set(['node_modules','.next','dist','coverage','playwright-report','test-results']);

function walk(path,target){
  const full=resolve(root,path);
  if(!existsSync(full))return;
  const stat=statSync(full);
  if(stat.isFile()){if(textExtensions.test(path))target.push(path);return;}
  for(const entry of readdirSync(full)){
    if(generatedDirectories.has(entry))continue;
    walk(join(path,entry),target);
  }
}
for(const path of documentationRoots)walk(path,documentationFiles);
for(const path of activeCodeRoots)walk(path,activeCodeFiles);

const failures=[];
const historical=(path)=>/V006/i.test(basename(path))||/V007/i.test(basename(path))||path.replaceAll('\\','/').endsWith('docs/releases/V0.0.7.md');
const currentMarkers=[
  /development version\s*:\s*\**v?0\.0\.7/i,
  /current development version\s*:\s*\**v?0\.0\.7/i,
  /current (?:software )?version\s*:\s*\**v?0\.0\.7/i,
  /(?:KINGMAST|product|software)\s+v?0\.0\.7\b/i,
  /(?:stays|remains|keep(?:s)?)\s+(?:on\s+)?\**v?0\.0\.7\**/i,
  /active\s+(?:\**)?v?0\.0\.7/i,
  /version\s+0\.0\.7\b/i,
];

for(const path of documentationFiles){
  if(historical(path))continue;
  const content=readFileSync(resolve(root,path),'utf8');
  const head=content.split(/\r?\n/).slice(0,64).join('\n');
  if(currentMarkers.some((pattern)=>pattern.test(head)))failures.push(path);
}
for(const path of activeCodeFiles){
  const content=readFileSync(resolve(root,path),'utf8');
  if(content.includes(previous))failures.push(path);
}

const versionFile=readFileSync(resolve(root,'VERSION'),'utf8').trim();
const rootPackage=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const workspacePackages=['apps/hmi/package.json','packages/contracts/package.json','services/risk-engine/package.json'];
if(versionFile!==current)failures.push(`VERSION=${versionFile}`);
if(rootPackage.version!==current)failures.push(`package.json=${rootPackage.version}`);
for(const path of workspacePackages){
  const pkg=JSON.parse(readFileSync(resolve(root,path),'utf8'));
  if(pkg.version!==current)failures.push(`${path}=${pkg.version}`);
}

if(failures.length){
  console.error(`Documentation/version contract failed: active material still identifies ${previous} as current/runtime version.`);
  for(const failure of [...new Set(failures)].sort())console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`KINGMAST documentation/version contract passed for v${current}; V006/V007 and v0.0.7 release checkpoint evidence remain historical.`);
