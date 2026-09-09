import { existsSync,readdirSync,readFileSync,statSync } from 'node:fs';
import { basename,join,relative,resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const current='0.0.7';
const previous='0.0.6';
const roots=['README.md','docs','safety'];
const files=[];

function walk(path){
  const full=resolve(root,path);
  if(!existsSync(full))return;
  const stat=statSync(full);
  if(stat.isFile()){if(path.endsWith('.md'))files.push(path);return;}
  for(const entry of readdirSync(full))walk(join(path,entry));
}
for(const path of roots)walk(path);

const failures=[];
const historical=(path)=>/V006/i.test(basename(path));
const currentMarkers=[
  /development version\s*:\s*\**v?0\.0\.6/i,
  /current development version\s*:\s*\**v?0\.0\.6/i,
  /current (?:software )?version\s*:\s*\**v?0\.0\.6/i,
  /(?:KINGMAST|product|software)\s+v?0\.0\.6\b/i,
  /(?:stays|remains|keep(?:s)?)\s+(?:on\s+)?\**v?0\.0\.6\**/i,
  /version\s+0\.0\.6\b/i,
];

for(const path of files){
  if(historical(path))continue;
  const content=readFileSync(resolve(root,path),'utf8');
  const head=content.split(/\r?\n/).slice(0,48).join('\n');
  if(currentMarkers.some((pattern)=>pattern.test(head)))failures.push(path);
}

const versionFile=readFileSync(resolve(root,'VERSION'),'utf8').trim();
const rootPackage=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
if(versionFile!==current)failures.push(`VERSION=${versionFile}`);
if(rootPackage.version!==current)failures.push(`package.json=${rootPackage.version}`);

if(failures.length){
  console.error(`Documentation/version contract failed: active material still identifies ${previous} as current.`);
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`KINGMAST documentation/version contract passed for v${current}; V006-named evidence remains historical.`);
