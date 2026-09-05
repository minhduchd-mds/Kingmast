import { readFileSync } from 'node:fs';

const paths=['vercel.json','apps/hmi/vercel.json'];
const failures=[];

for(const path of paths){
  let config;
  try{config=JSON.parse(readFileSync(path,'utf8'));}
  catch(error){failures.push(`${path}: invalid JSON (${error instanceof Error?error.message:String(error)})`);continue;}

  const policy=config?.git?.deploymentEnabled;
  if(!policy||typeof policy!=='object'||Array.isArray(policy)){
    failures.push(`${path}: git.deploymentEnabled must be an explicit branch policy object`);
    continue;
  }
  if(policy.main!==true)failures.push(`${path}: main must remain deployment-enabled`);
  if(policy['**']!==false)failures.push(`${path}: all non-main branches must be deployment-disabled by the catch-all rule`);
  if(config.ignoreCommand)failures.push(`${path}: ignoreCommand creates ignored deployment records; use git.deploymentEnabled instead`);
}

if(failures.length){
  console.error('KINGMAST Vercel deployment policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}

console.log('KINGMAST Vercel deployment policy passed: automatic Git deployments are main-only.');
