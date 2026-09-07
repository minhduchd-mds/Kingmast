import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';

function sha256(buffer){return createHash('sha256').update(buffer).digest('hex');}
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

const commit=(process.env.KINGMAST_SOURCE_COMMIT??process.env.GITHUB_SHA??'').trim();
if(!/^[a-f0-9]{40}$/i.test(commit))throw new Error('KINGMAST evidence anchor requires a full 40-character source commit SHA');
const requested=(process.env.KINGMAST_EVIDENCE_PATHS??'').split(',').map((item)=>item.trim()).filter(Boolean);
if(requested.length<3)throw new Error('KINGMAST_EVIDENCE_PATHS must contain at least three evidence files');
const seen=new Set();
const materials=requested.map((path)=>{
  const full=resolve(path);
  const name=basename(path);
  if(seen.has(name))throw new Error(`duplicate evidence material name ${name}`);
  seen.add(name);
  const content=readFileSync(full);
  return{name,sha256:sha256(content),bytes:content.byteLength};
}).sort((a,b)=>a.name.localeCompare(b.name));
const rootPayload={schema:'kingmast-evidence-anchor-payload/v1',commit,materials:materials.map(({name,sha256})=>({name,sha256}))};
const rootSha256=sha256(Buffer.from(canonical(rootPayload),'utf8'));
const output={
  schema:'kingmast-evidence-anchor/v1',
  algorithm:'sha256',
  sourceCommit:commit,
  actuatorAuthority:'none',
  externalTimestampAuthority:'none',
  externallySigned:false,
  materials,
  rootSha256,
};
process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
