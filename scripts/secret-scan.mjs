import { open,readdir } from 'node:fs/promises';
import { extname,join,relative } from 'node:path';

const root=process.cwd();
const roots=['apps','services','packages','edge','scripts','database','safety','docs','.github'];
const textExtensions=new Set(['.ts','.tsx','.js','.mjs','.cjs','.json','.yml','.yaml','.md','.sql','.py','.ino','.h','.hpp','.c','.cpp','.css','.scss','.html','.txt','.toml']);
const maxBytes=1_000_000;
const ignoredPaths=new Set(['.env.example','docs/cybersecurity/DEVICE_IDENTITY_V006.md']);
const findings=[];

const patterns=[
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['openai-key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['aws-access-key',/\bAKIA[0-9A-Z]{16}\b/],
  ['google-api-key',/\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['slack-token',/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['stripe-live-secret',/\bsk_live_[A-Za-z0-9]{20,}\b/],
  ['neon-password-token',/\bnpg_[A-Za-z0-9]{12,}\b/],
];

function report(path,line,kind){findings.push(`${path}:${line}: ${kind}`);}
function isPlaceholder(value){return /replace|example|placeholder|dummy|sample|changeme|your[-_]|<|>|\*\*\*/i.test(value);}
function inspectLine(path,lineText,lineNumber){
  for(const [kind,pattern] of patterns)if(pattern.test(lineText))report(path,lineNumber,kind);
  const dsn=lineText.match(/\bpostgres(?:ql)?:\/\/([^:\s/]+):([^@\s/]+)@([^\s/:]+)/i);
  if(dsn){const [,user,password,host]=dsn;if(!['localhost','127.0.0.1','::1'].includes(host.toLowerCase())&&!isPlaceholder(password)&&password!==user)report(path,lineNumber,'remote-database-credential');}
  const assignment=lineText.match(/^\s*([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]{24,})/i);
  if(assignment){const value=assignment[2];if(!value.includes('process.env')&&!value.includes('${{')&&!isPlaceholder(value)&&!/^[A-Z0-9_]+$/.test(value))report(path,lineNumber,'hardcoded-secret-assignment');}
}

async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(['node_modules','.git','.next','dist','build','coverage','playwright-report','test-results'].includes(entry.name))continue;
    const full=join(dir,entry.name);
    if(entry.isDirectory()){await walk(full);continue;}
    const rel=relative(root,full).replaceAll('\\','/');
    if(ignoredPaths.has(rel))continue;
    if(!textExtensions.has(extname(entry.name))&&!['Dockerfile','CODEOWNERS'].includes(entry.name))continue;
    const handle=await open(full,'r');
    try{
      const info=await handle.stat();
      if(info.size>maxBytes)continue;
      const text=await handle.readFile('utf8');
      text.split(/\r?\n/).forEach((line,index)=>inspectLine(rel,line,index+1));
    }finally{
      await handle.close();
    }
  }
}

for(const base of roots){try{await walk(join(root,base));}catch(error){if(error?.code!=='ENOENT')throw error;}}
if(findings.length){console.error('KINGMAST repository secret scan failed:\n'+findings.map((item)=>`- ${item}`).join('\n')+'\nSecret values are intentionally not printed. Rotate/revoke any real credential before removing it from code/history.');process.exit(1);}
console.log('KINGMAST repository secret scan passed: no high-confidence committed secret patterns detected.');