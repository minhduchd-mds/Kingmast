import {createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';

function sha256(buffer){return createHash('sha256').update(buffer).digest('hex');}
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function equalHex(a,b){
  if(!/^[a-f0-9]{64}$/i.test(a)||!/^[a-f0-9]{64}$/i.test(b))return false;
  const left=Buffer.from(a,'hex'),right=Buffer.from(b,'hex');
  return left.length===right.length&&timingSafeEqual(left,right);
}

const anchorPath=(process.env.KINGMAST_EVIDENCE_ANCHOR_PATH??process.argv[2]??'').trim();
if(!anchorPath)throw new Error('evidence anchor path is required');
const anchor=JSON.parse(readFileSync(resolve(anchorPath),'utf8'));
if(anchor.schema!=='kingmast-evidence-anchor/v1'||anchor.algorithm!=='sha256')throw new Error('unsupported KINGMAST evidence anchor');
if(anchor.actuatorAuthority!=='none'||anchor.externallySigned!==false||anchor.externalTimestampAuthority!=='none')throw new Error('evidence anchor trust-boundary markers are invalid');
const expectedCommit=(process.env.KINGMAST_SOURCE_COMMIT??process.env.GITHUB_SHA??'').trim();
if(expectedCommit&&anchor.sourceCommit!==expectedCommit)throw new Error('evidence anchor source commit mismatch');
const requested=(process.env.KINGMAST_EVIDENCE_PATHS??'').split(',').map((item)=>item.trim()).filter(Boolean);
if(requested.length===0)throw new Error('KINGMAST_EVIDENCE_PATHS is required for verification');
const actualByName=new Map(requested.map((path)=>{
  const content=readFileSync(resolve(path));
  return[basename(path),{sha256:sha256(content),bytes:content.byteLength}];
}));
if(!Array.isArray(anchor.materials)||anchor.materials.length!==actualByName.size)throw new Error('evidence anchor material count mismatch');
for(const material of anchor.materials){
  const actual=actualByName.get(material.name);
  if(!actual||actual.bytes!==material.bytes||!equalHex(actual.sha256,material.sha256))throw new Error(`evidence material mismatch: ${material.name}`);
}
const materials=anchor.materials.map(({name,sha256})=>({name,sha256})).sort((a,b)=>a.name.localeCompare(b.name));
const rootPayload={schema:'kingmast-evidence-anchor-payload/v1',commit:anchor.sourceCommit,materials};
const expectedRoot=sha256(Buffer.from(canonical(rootPayload),'utf8'));
if(!equalHex(expectedRoot,anchor.rootSha256))throw new Error('evidence anchor root mismatch');
console.log(`KINGMAST evidence anchor verified: ${anchor.rootSha256} (${anchor.materials.length} materials)`);
