import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=process.cwd();
const failures=[];
const productionRoots=['apps/hmi','services/risk-engine','packages/contracts','edge'];
const sourceExt=/\.(?:ts|tsx|js|mjs|cjs|py|ino|h|hpp|cpp)$/;
const hmiForbiddenImports=new Set(['child_process','node:child_process','node:net','net','node:dgram','dgram']);

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
      if(rel.startsWith('apps/hmi/')&&hmiForbiddenImports.has(specifier))failures.push(`${rel}: HMI must not gain shell/raw-socket escape capability via ${specifier}`);
      if(rel.startsWith('services/risk-engine/')&&specifier.includes('apps/hmi'))failures.push(`${rel}: risk engine must not depend on HMI implementation`);
      if(rel.startsWith('packages/contracts/')&&(specifier.includes('apps/')||specifier.includes('services/')||specifier.includes('edge/')))failures.push(`${rel}: shared contracts must remain independent of application/service/hardware implementations`);
    }
    if(rel.startsWith('apps/hmi/')&&/\/dev\/(?:can|tty|gpio|mem)\w*/i.test(text))failures.push(`${rel}: HMI must not address vehicle/device nodes directly`);
    if(rel.startsWith('apps/hmi/')&&/\b(?:can\.write|sendCanFrame|transmitCan|commandBrake|commandSteer|applyBrake|applyThrottle)\b/i.test(text))failures.push(`${rel}: HMI contains prohibited vehicle-control surface`);
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

function checkUnit(path,user,port){
  const unit=readFileSync(resolve(root,path),'utf8');
  const expect=(condition,message)=>{if(!condition)failures.push(`${path}: ${message}`);};
  expect(unit.includes(`User=${user}`),'must run under its dedicated non-root user');
  expect(!/^User=root$/m.test(unit),'must never run as root');
  expect(unit.includes('NoNewPrivileges=true'),'NoNewPrivileges must remain enabled');
  expect(unit.includes('PrivateDevices=true')&&unit.includes('DevicePolicy=closed'),'real device nodes must remain hidden/closed');
  expect(unit.includes('CapabilityBoundingSet=\n')&&unit.includes('AmbientCapabilities=\n'),'Linux capabilities must remain empty');
  expect(unit.includes('ProtectSystem=strict')&&unit.includes('ProtectHome=true'),'filesystem isolation must remain strict');
  expect(unit.includes('RestrictNamespaces=true'),'namespace creation must remain blocked');
  expect(unit.includes('SocketBindDeny=any')&&unit.includes(`SocketBindAllow=tcp:${port}`),'listener ports must remain deny-by-default');
  expect(unit.includes('127.0.0.1'),'service must remain loopback-bound');
  expect(!unit.includes('0.0.0.0'),'service must not bind every interface');
  expect(!/\/dev\/(?:can|tty|gpio|mem)/i.test(unit),'service must not expose vehicle/device nodes');
}

checkUnit('deploy/systemd/kingmast-hmi.service','kingmast-hmi',3000);
checkUnit('deploy/systemd/kingmast-risk-engine.service','kingmast-risk',4000);

if(failures.length){console.error('KINGMAST architecture boundary check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST architecture boundary check passed: HMI/risk-engine process isolation, shell/device boundaries and read-only vehicle authority remain enforced.');
