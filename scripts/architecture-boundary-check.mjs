import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=process.cwd();
const failures=[];
const productionRoots=['apps/hmi','services/risk-engine','packages/contracts','edge'];
const sourceExt=/\.(?:ts|tsx|js|mjs|cjs|py|ino|h|hpp|cpp)$/;

function walk(dir){
  const full=resolve(root,dir);
  const files=[];
  for(const entry of readdirSync(full)){
    if(['node_modules','.next','dist','build','coverage'].includes(entry))continue;
    const path=join(full,entry);
    const stat=statSync(path);
    if(stat.isDirectory())files.push(...walk(relative(root,path)));
    else if(sourceExt.test(entry))files.push(path);
  }
  return files;
}

function imports(text){
  const values=[];
  for(const match of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g))values.push(match[1]);
  return values;
}

for(const base of productionRoots){
  for(const file of walk(base)){
    const rel=relative(root,file).replaceAll('\\','/');
    const text=readFileSync(file,'utf8');
    for(const specifier of imports(text)){
      if(specifier.includes('autonomy-lab'))failures.push(`${rel}: production code must not import simulation-only autonomy-lab`);
      if(rel.startsWith('apps/hmi/')&&(specifier.includes('services/risk-engine/src')||specifier.startsWith('../../../services/')||specifier.startsWith('../../services/')))failures.push(`${rel}: HMI must use contracts/network boundary, not risk-engine source imports`);
      if(rel.startsWith('apps/hmi/')&&(specifier.includes('edge/esp32')||specifier.includes('edge/camera-detector')))failures.push(`${rel}: HMI must not import hardware publisher implementation`);
      if(rel.startsWith('services/risk-engine/')&&specifier.includes('apps/hmi'))failures.push(`${rel}: risk engine must not depend on HMI implementation`);
      if(rel.startsWith('packages/contracts/')&&(specifier.includes('apps/')||specifier.includes('services/')||specifier.includes('edge/')))failures.push(`${rel}: shared contracts must remain independent of application/service/hardware implementations`);
    }
  }
}

const vehicleContractPath=resolve(root,'packages/contracts/src/vehicle-readonly.ts');
const vehicleContract=readFileSync(vehicleContractPath,'utf8');
const interfaceMatch=vehicleContract.match(/export interface ReadOnlyVehiclePort\s*\{([\s\S]*?)\n\}/);
if(!interfaceMatch)failures.push('vehicle-readonly.ts: ReadOnlyVehiclePort interface missing');
else{
  const body=interfaceMatch[1];
  if(!body.includes('readonly authority:typeof VEHICLE_PORT_AUTHORITY'))failures.push('ReadOnlyVehiclePort must expose immutable read-only authority marker');
  if(!body.includes('readSnapshot('))failures.push('ReadOnlyVehiclePort must expose readSnapshot');
  if(/\b(?:write|send|transmit|command|actuate|brake|steer|throttle|torque|gear|set[A-Z]|apply[A-Z])\w*\s*\(/i.test(body))failures.push('ReadOnlyVehiclePort contains a prohibited write/actuation-like method');
}

if(failures.length){console.error('KINGMAST architecture boundary check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST architecture boundary check passed: production, simulation, HMI, contracts and read-only vehicle boundaries remain separated.');
