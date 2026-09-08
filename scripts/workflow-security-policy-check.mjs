import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const workflowDir='.github/workflows';
const failures=[];
const files=readdirSync(workflowDir).filter((name)=>/\.ya?ml$/i.test(name)).sort();

for(const name of files){
  const path=join(workflowDir,name);
  const source=readFileSync(path,'utf8');
  const lines=source.split(/\r?\n/);

  if(/\bpull_request_target\s*:/m.test(source))failures.push(`${path}: pull_request_target is forbidden for this repository`);
  if(/permissions\s*:\s*write-all\b/i.test(source))failures.push(`${path}: write-all permissions are forbidden`);

  for(const [index,line] of lines.entries()){
    const match=line.match(/^(\s*)-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if(!match)continue;
    const [,indentText,action]=match;
    if(action.startsWith('./'))continue;
    if(!/@[a-f0-9]{40}$/i.test(action))failures.push(`${path}:${index+1}: action must be pinned to an immutable 40-character commit SHA (${action})`);

    if(action.startsWith('actions/checkout@')){
      const actionIndent=indentText.length;
      let persistCredentialsDisabled=false;
      for(let cursor=index+1;cursor<lines.length;cursor+=1){
        const candidate=lines[cursor];
        if(!candidate.trim())continue;
        const candidateIndent=(candidate.match(/^\s*/)?.[0].length)??0;
        if(candidateIndent<=actionIndent&&/^\s*-\s+/.test(candidate))break;
        if(/^\s+persist-credentials:\s*false(?:\s+#.*)?$/i.test(candidate)){
          persistCredentialsDisabled=true;
          break;
        }
      }
      if(!persistCredentialsDisabled)failures.push(`${path}:${index+1}: actions/checkout must set persist-credentials: false`);
    }
  }
}

if(files.length===0)failures.push('no GitHub Actions workflows found');

if(failures.length){
  console.error(`KINGMAST workflow security policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`KINGMAST workflow security policy passed for ${files.length} workflow(s).`);
