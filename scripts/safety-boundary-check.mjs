import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots=['services','edge','apps/hmi','packages/contracts'];
const extensions=new Set(['.ts','.tsx','.js','.mjs','.py','.ino','.h','.cpp']);
const forbidden=[
  /\bsetSteering\b/i,
  /\bsetThrottle\b/i,
  /\bapplyBrake\b/i,
  /\bcommandBrake\b/i,
  /\bcommandSteer\b/i,
  /\bcommandThrottle\b/i,
  /\bsetGear\b/i,
  /\bcommandGear\b/i,
  /\bsetTorque\b/i,
  /\bcommandTorque\b/i,
  /\bwriteCanFrame\b/i,
  /\bsendCanFrame\b/i,
  /\btransmitCanFrame\b/i,
  /\bwriteCanMessage\b/i,
  /\bsendCanMessage\b/i,
  /\btransmitCanMessage\b/i,
  /\bsendActuatorCommand\b/i,
  /\bissueActuatorCommand\b/i,
  /\bvehicleControlCommand\b/i,
];
const findings=[];

async function walk(path){
  for(const entry of await readdir(path,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='.next'||entry.name==='dist')continue;
    const target=join(path,entry.name);
    if(entry.isDirectory())await walk(target);
    else if(extensions.has(extname(entry.name))){
      const source=await readFile(target,'utf8');
      for(const pattern of forbidden)if(pattern.test(source))findings.push(`${target}: ${pattern}`);
    }
  }
}
for(const root of roots)await walk(root);

const readOnlyContract=await readFile('packages/contracts/src/vehicle-readonly.ts','utf8');
const contractsPackage=await readFile('packages/contracts/package.json','utf8');
if(!readOnlyContract.includes("VEHICLE_PORT_AUTHORITY='read-only'"))findings.push('packages/contracts/src/vehicle-readonly.ts: missing explicit read-only authority');
if(!readOnlyContract.includes('interface ReadOnlyVehiclePort'))findings.push('packages/contracts/src/vehicle-readonly.ts: missing ReadOnlyVehiclePort interface');
if(!contractsPackage.includes('"./vehicle-readonly":"./src/vehicle-readonly.ts"'))findings.push('packages/contracts/package.json: read-only vehicle port export missing');

if(findings.length){console.error('KINGMAST warning-only safety boundary violation:\n'+findings.join('\n'));process.exit(1);}
console.log('KINGMAST safety boundary check passed: actuator APIs absent and read-only vehicle contract enforced.');
