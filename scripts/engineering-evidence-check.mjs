import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const required=[
  'docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md',
  'docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md',
  'docs/safety/ODD_V006.md',
  'docs/safety/HARA_DRAFT_V006.md',
  'docs/safety/SOTIF_SCENARIO_CATALOG_V006.md',
  'docs/cybersecurity/TARA_V006.md',
  'docs/updates/SUMS_OTA_ARCHITECTURE_V006.md',
  'docs/validation/SIL_HIL_FAULT_INJECTION_PLAN_V006.md',
  '.github/CODEOWNERS',
];
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
for(const path of required)read(path);
const plan=read('docs/program/KINGMAST_FULL_UPGRADE_PLAN_2026.md');
const odd=read('docs/safety/ODD_V006.md');
const research=read('docs/research/OEM_BENCHMARK_CLEAN_ROOM_2026.md');
const codeowners=read('.github/CODEOWNERS');
if(!/warning-only/i.test(plan)||!/no steering|no code path.*actuator|vehicle actuation is prohibited/i.test(plan))failures.push('program plan must preserve explicit Level-0/no-actuation boundary');
if(!/Public-road deployment is outside this ODD/i.test(odd))failures.push('ODD must keep public-road deployment outside v0.0.6 research boundary');
if(!/public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation/i.test(research))failures.push('clean-room research transformation rule missing');
for(const requiredOwnerPath of ['/safety/','/services/risk-engine/','/edge/','/packages/contracts/','/.github/workflows/'])if(!codeowners.includes(requiredOwnerPath))failures.push(`CODEOWNERS missing ${requiredOwnerPath}`);
if(failures.length){console.error('KINGMAST engineering evidence check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST engineering evidence check passed.');