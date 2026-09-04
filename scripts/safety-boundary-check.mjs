import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots=['services','edge'];
const extensions=new Set(['.ts','.tsx','.js','.mjs','.py','.ino','.h','.cpp']);
const forbidden=[/\bsetSteering\b/,/\bsetThrottle\b/,/\bapplyBrake\b/,/\bcommandBrake\b/,/\bcommandSteer\b/,/\bcommandThrottle\b/,/\bwriteCanFrame\b/,/\bsendActuatorCommand\b/];
const findings=[];

async function walk(path){
  for(const entry of await readdir(path,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git')continue;
    const target=join(path,entry.name);
    if(entry.isDirectory())await walk(target);
    else if(extensions.has(extname(entry.name))){
      const source=await readFile(target,'utf8');
      for(const pattern of forbidden)if(pattern.test(source))findings.push(`${target}: ${pattern}`);
    }
  }
}
for(const root of roots)await walk(root);
if(findings.length){console.error('KINGMAST warning-only safety boundary violation:\n'+findings.join('\n'));process.exit(1);}
console.log('KINGMAST safety boundary check passed: no actuator command APIs detected.');
