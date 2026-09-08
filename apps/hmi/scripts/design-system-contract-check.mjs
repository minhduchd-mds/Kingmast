import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function fail(message){failures.push(message);}
function read(path){const full=resolve(root,path);if(!existsSync(full)){fail(`${path}: missing`);return'';}return readFileSync(full,'utf8');}

const layout=read('app/layout.tsx');
const tokens=read('app/hmi-design-system.css');
const globals=read('app/globals.css');
const requiredTokens=[
  '--km-color-background','--km-color-surface','--km-color-surface-strong','--km-color-text','--km-color-text-secondary',
  '--km-color-accent','--km-color-safe','--km-color-caution','--km-color-critical','--km-touch-min: 44px','--km-touch-primary: 48px',
  '--km-radius-sm','--km-radius-md','--km-radius-lg','--km-radius-xl','--km-motion-quick','--km-motion-standard','--km-motion-emphasized','--km-focus-ring',
];
for(const token of requiredTokens)if(!tokens.includes(token))fail(`semantic design token missing: ${token}`);
const globalsIndex=layout.indexOf("import './globals.css';");
const designIndex=layout.indexOf("import './hmi-design-system.css';");
const versionIndex=layout.indexOf("import './hmi-v3.css';");
if(globalsIndex<0||designIndex<0||versionIndex<0||!(globalsIndex<designIndex&&designIndex<versionIndex))fail('design-system layer must load after globals and before versioned HMI compatibility layers');
if(!tokens.includes('--km-color-background: var(--bg)')||!tokens.includes('--km-color-text: var(--text)')||!tokens.includes('--km-color-safe: var(--safe)'))fail('semantic tokens must alias theme-aware source variables rather than replace them');
if(!globals.includes('--radius-sm:')||!globals.includes('--motion-standard:')||!globals.includes('--safe:'))fail('legacy source tokens required by semantic aliases are missing');
if(/--bg\s*:|--surface\s*:|--text\s*:/m.test(tokens))fail('semantic layer must not override legacy theme source variables');

if(failures.length){console.error('KINGMAST HMI design-system contract failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`KINGMAST HMI design-system contract passed with ${requiredTokens.length} canonical semantic tokens and preserved theme compatibility.`);
