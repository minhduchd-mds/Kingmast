import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const css=read('app/hmi-apple.css');
const interactionCss=read('app/hmi-interactions.css');
const layout=read('app/layout.tsx');
const startup=read('components/StartupExperience.tsx');
const shell=read('components/KingmastV006.tsx');
const interaction=read('components/DriverInteractionLayer.tsx');
const settings=read('components/HmiSettingsPanel.tsx');
const pkg=JSON.parse(read('package.json'));

const checks=[
  ['development version remains 0.0.6',pkg.version==='0.0.6'],
  ['Apple-inspired base layer is loaded',layout.includes("import './hmi-apple.css';")],
  ['interaction layer is imported last',layout.trim().includes("import './hmi-interactions.css';\nexport const metadata")],
  ['startup announces status changes accessibly',startup.includes('aria-live="polite"')&&startup.includes('role="status"')],
  ['startup communicates warning-only assistance',startup.includes('Warning-only assistance')],
  ['startup has a deterministic completion callback',startup.includes('completeRef.current()')],
  ['live vehicle sessions are not silently replaced by simulator context',shell.includes('KINGMAST will not substitute simulator road context over a live vehicle session')],
  ['automotive touch target token is at least 52px',css.includes('--apple-touch-target:52px')],
  ['quick action dock uses 56px driving targets',interactionCss.includes('min-height:56px')],
  ['focus-visible treatment is present',interactionCss.includes(':focus-visible')&&interactionCss.includes('outline:3px solid #79bfff')],
  ['reduced-motion mode is present',interactionCss.includes('@media(prefers-reduced-motion:reduce)')],
  ['high-contrast mode is present',interactionCss.includes('@media(prefers-contrast:more)')],
  ['short landscape hides secondary connected-road layer',interactionCss.includes('@media(max-height:560px)')&&interactionCss.includes('.connectedRoadHud{display:none}')],
  ['critical driver warning style is explicit',css.includes('.driverAlert.severity-critical')],
  ['caution driver warning style is explicit',css.includes('.driverAlert.severity-caution')],
  ['speed remains visually dominant',css.includes('.speedValue{font-size:clamp(88px,7.4vw,118px)')],
  ['route scene has restrained route guidance depth',css.includes('.v5RoadScene::before')],
  ['driver action sheet is non-destructive',interaction.includes('Keep current route')&&interaction.includes('Acknowledge')],
  ['critical safety warnings cannot be disabled in settings',settings.includes('Critical collision and vulnerable-road-user warnings cannot be disabled here')],
  ['camera warning setting calls out local law',settings.includes('subject to local law')],
  ['Playwright UI test script is configured',pkg.scripts?.['test:ui']==='playwright test'],
  ['production start script is configured for UI verification',pkg.scripts?.start==='next start'],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  for(const [name] of failed)console.error(`UI RULE FAIL: ${name}`);
  process.exit(1);
}
for(const [name] of checks)console.log(`UI RULE PASS: ${name}`);
