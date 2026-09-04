import { existsSync,readFileSync,readdirSync,statSync } from 'node:fs';
import { join,relative } from 'node:path';

const ROOT=process.cwd();
const scanRoots=['services/risk-engine/src','apps/hmi','edge/esp32'];
const textExtensions=new Set(['.ts','.tsx','.js','.mjs','.ino','.h']);
const failures=[];

function extension(path){const index=path.lastIndexOf('.');return index>=0?path.slice(index):'';}
function walk(path){for(const name of readdirSync(path)){const full=join(path,name);const info=statSync(full);if(info.isDirectory()){if(name==='node_modules'||name==='.next'||name==='dist')continue;walk(full);continue;}if(!textExtensions.has(extension(name)))continue;checkFile(full);}}
function fail(path,message){failures.push(`${relative(ROOT,path)}: ${message}`);}
function checkFile(path){const source=readFileSync(path,'utf8');if(source.includes('@ts-ignore')||source.includes('@ts-nocheck'))fail(path,'TypeScript suppression is not allowed in production source');if(/if\s*\(\s*!EDGE_TOKEN\s*\)\s*return\s+true/.test(source))fail(path,'edge authentication must never fail open');if(/host\s*:\s*['\"]0\.0\.0\.0['\"]/.test(source))fail(path,'risk API must not bind publicly by default');if(source.includes('.setInsecure(')||source.includes('setInsecure()'))fail(path,'TLS certificate verification may not be disabled');if(path.endsWith('config.example.h')&&/#define\s+KINGMAST_API_URL\s+"http:\/\//.test(source))fail(path,'ESP32 example endpoint must use HTTPS');}

for(const root of scanRoots){const full=join(ROOT,root);if(existsSync(full))walk(full);}
if(!existsSync(join(ROOT,'pnpm-lock.yaml')))fail(join(ROOT,'pnpm-lock.yaml'),'reproducible lockfile is required');

if(failures.length){console.error('KINGMAST source hygiene check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST source hygiene check passed.');
