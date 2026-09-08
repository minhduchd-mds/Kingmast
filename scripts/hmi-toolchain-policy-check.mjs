import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function fail(message){failures.push(message);}
function readJson(path){const full=resolve(root,path);if(!existsSync(full)){fail(`${path}: missing`);return null;}try{return JSON.parse(readFileSync(full,'utf8'));}catch{fail(`${path}: invalid JSON`);return null;}}

const rootPackage=readJson('package.json');
const hmiPackage=readJson('apps/hmi/package.json');
const tsconfig=readJson('apps/hmi/tsconfig.json');

const rootTs=rootPackage?.devDependencies?.typescript??'';
const hmiTs=hmiPackage?.devDependencies?.typescript??'';
const next=hmiPackage?.dependencies?.next??'';
if(!/^\^?7\./.test(rootTs)||!/^\^?7\./.test(hmiTs))fail('root and HMI TypeScript baselines must remain on major 7');
if(!/^\^?16\./.test(next))fail('HMI Next.js baseline must remain on major 16');
if(tsconfig?.compilerOptions?.jsx!=='react-jsx')fail('Next 16 HMI tsconfig must explicitly use react-jsx to avoid build-time mutation');
const include=Array.isArray(tsconfig?.include)?tsconfig.include:[];
if(!include.includes('.next/types/**/*.ts')||!include.includes('.next/dev/types/**/*.ts'))fail('Next 16 generated production and development type roots must be explicit in tsconfig');
if(tsconfig?.compilerOptions?.moduleResolution!=='bundler'||tsconfig?.compilerOptions?.strict!==true)fail('HMI TypeScript must preserve strict bundler-resolution baseline');

if(failures.length){console.error('KINGMAST HMI toolchain policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST HMI toolchain policy passed: Next 16 + TypeScript 7 configuration is explicit and build-stable.');
