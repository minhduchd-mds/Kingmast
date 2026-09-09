import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const repo=resolve(root,'../..');
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const readRepo=(path)=>readFileSync(resolve(repo,path),'utf8');
const failures=[];
const expect=(name,condition)=>{if(!condition)failures.push(name);};

const i18n=read('lib/i18n.ts');
const profile=read('lib/use-driver-profile.ts');
const profilePanel=read('components/DriverProfilePanel.tsx');
const settings=read('components/HmiSettingsPanel.tsx');
const devices=read('components/DeviceHealthPanel.tsx');
const assistant=read('components/AssistantOverlay.tsx');
const assistantRuntime=read('components/AssistantRuntime.tsx');
const provider=read('app/api/kingmast/assistant/route.ts');
const layout=read('app/layout.tsx');
const env=readRepo('.env.example');
const riskAssistant=readRepo('services/risk-engine/src/ai-assistant.ts');

expect('vi-VN dictionary exists',i18n.includes("'vi-VN':VI")&&i18n.includes("'settings.title':'Cài đặt KINGMAST'")&&i18n.includes("'assistant.title':'Trợ lý KINGMAST'"));
expect('profile applies HTML language',profile.includes("root.lang = profile.locale === 'vi-VN' ? 'vi' : 'en'"));
expect('language selector exposes Vietnamese',profilePanel.includes('<option value="vi-VN">Tiếng Việt</option>'));
expect('primary settings use localization runtime',settings.includes("useI18n")&&settings.includes("t('settings.title')")&&settings.includes('<DeviceHealthPanel/>'));
expect('device diagnostics use localization runtime',devices.includes('useI18n')&&devices.includes("t('device.faultPoint')")&&devices.includes("t('common.runDiagnostics')"));
expect('assistant waits until first-run is complete',assistantRuntime.includes("kingmast:v006:first-run-complete")&&assistantRuntime.includes('ready?<AssistantOverlay/>:null'));
expect('assistant is mounted at HMI root',layout.includes("import AssistantRuntime")&&layout.includes('<AssistantRuntime/>'));
expect('moving mode blocks text composer',assistant.includes('disabled={moving||busy}')&&assistant.includes("if(moving)setInput('')"));
expect('voice supports native and browser fallbacks',assistant.includes('kingmastNative?.voice')&&assistant.includes('webkitSpeechRecognition')&&assistant.includes('speechSynthesis'));
expect('assistant keeps bounded message history',assistant.includes('current.slice(-7)')&&assistant.includes('slice(0,240)'));
expect('assistant does not persist transcript',!assistant.includes('localStorage.setItem')&&!assistant.includes('sessionStorage.setItem'));
expect('offline fallback exists',assistant.includes("'offline-fallback'")&&assistant.includes('localFallback(question)'));
expect('provider adapter is server-side',provider.includes("KINGMAST_ASSISTANT_PROVIDER_TOKEN")&&!assistant.includes('KINGMAST_ASSISTANT_PROVIDER_TOKEN'));
expect('provider token is never NEXT_PUBLIC',!env.includes('NEXT_PUBLIC_KINGMAST_ASSISTANT_PROVIDER_TOKEN')&&!provider.includes('NEXT_PUBLIC_KINGMAST_ASSISTANT_PROVIDER_TOKEN'));
expect('external provider requires TLS except loopback',provider.includes("url.protocol==='https:'")&&provider.includes("url.protocol==='http:'&&isLoopback(url.hostname)"));
expect('provider obtains grounded plan before answering',provider.includes('/v3/assistant/plan')&&provider.includes('fetchGroundedPlan(input)'));
expect('provider sends no actuator tool surface',provider.includes("controlAuthority:'none'")&&!provider.includes('tools:[{')&&!provider.includes('functions:['));
expect('provider uses deterministic fallback',provider.includes('deterministicAnswer')&&provider.includes("mode='offline-fallback'"));
expect('device metadata is bounded and excludes raw identity fields',provider.includes('slice(0,16)')&&provider.includes('faults.slice(0,8)')&&!provider.includes('serialNumber')&&!provider.includes('rawVideo')&&!provider.includes('coordinates'));
expect('risk assistant allowlist remains read-only',riskAssistant.includes('ASSISTANT_TOOL_ALLOWLIST')&&!riskAssistant.match(/AssistantTool=.*brake|AssistantTool=.*steer|AssistantTool=.*throttle|AssistantTool=.*gear|AssistantTool=.*torque|AssistantTool=.*can\.write/i));
expect('Vietnamese no-diacritic normalization exists',riskAssistant.includes("normalize('NFD')")&&riskAssistant.includes("replace(/đ/g,'d')"));

if(failures.length){console.error(`Assistant safety contract failed (${failures.length})`);for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Assistant safety contract passed');
