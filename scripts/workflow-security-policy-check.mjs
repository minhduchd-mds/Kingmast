import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const workflowDir='.github/workflows';
const failures=[];
const files=readdirSync(workflowDir).filter((name)=>/\.ya?ml$/i.test(name)).sort();

for(const name of files){
  const path=join(workflowDir,name);
  const source=readFileSync(path,'utf8');

  if(/\bpull_request_target\s*:/m.test(source))failures.push(`${path}: pull_request_target is forbidden for this repository`);
  if(/permissions\s*:\s*write-all\b/i.test(source))failures.push(`${path}: write-all permissions are forbidden`);

  for(const [index,line] of source.split(/\r?\n/).entries()){
    const match=line.match(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if(!match)continue;
    const action=match[1];
    if(action.startsWith('./'))continue;
    if(!/@[a-f0-9]{40}$/i.test(action))failures.push(`${path}:${index+1}: action must be pinned to an immutable 40-character commit SHA (${action})`);
  }

  if(source.includes('actions/checkout@')&&!/actions\/checkout@[a-f0-9]{40}[^\n]*\n\s+with:\n(?:\s+[^\n]+\n)*?\s+persist-credentials:\s*false\b/im.test(source)){
    failures.push(`${path}: actions/checkout must set persist-credentials: false`);
  }
}

if(files.length===0)failures.push('no GitHub Actions workflows found');

if(failures.length){
  console.error(`KINGMAST workflow security policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`KINGMAST workflow security policy passed for ${files.length} workflow(s).`);
