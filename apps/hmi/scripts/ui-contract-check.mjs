import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const css=read('app/hmi-apple.css');
const layout=read('app/layout.tsx');
const startup=read('components/StartupExperience.tsx');
const shell=read('components/KingmastV006.tsx');
const pkg=JSON.parse(read('package.json'));

const checks=[
  ['development version remains 0.0.6',pkg.version==='0.0.6'],
  ['Apple-inspired production layer is imported last',layout.includes("import './hmi-apple.css';")],
  ['startup announces status changes accessibly',startup.includes('aria-live="polite"')&&startup.includes('role="status"')],
  ['startup communicates warning-only assistance',startup.includes('Warning-only assistance')],
  ['startup has a deterministic completion callback',startup.includes('completeRef.current()')],
  ['live vehicle sessions are not silently replaced by simulator context',shell.includes('KINGMAST will not substitute simulator road context over a live vehicle session')],
  ['automotive touch target token is at least 52px',css.includes('--apple-touch-target:52px')],
  ['focus-visible treatment is present',css.includes(':focus-visible')&&css.includes('outline:3px solid #79bfff')],
  ['reduced-motion mode is present',css.includes('@media(prefers-reduced-motion:reduce)')],
  ['high-contrast mode is present',css.includes('@media(prefers-contrast:more)')],
  ['1366x768-class guard is present',css.includes('@media(min-width:1180px) and (max-height:800px)')],
  ['1280x480-class short landscape guard is present',css.includes('@media(max-height:560px) and (min-width:1000px)')],
  ['critical driver warning style is explicit',css.includes('.driverAlert.severity-critical')],
  ['caution driver warning style is explicit',css.includes('.driverAlert.severity-caution')],
  ['speed remains visually dominant',css.includes('.speedValue{font-size:clamp(88px,7.4vw,118px)')],
  ['route scene has restrained route guidance depth',css.includes('.v5RoadScene::before')],
  ['startup motion has reduced-motion escape hatch',css.includes('.startupGlow,.startupHero,.startupRouteTrace,.startupVehicle{animation:none!important}')],
  ['connected-road ribbon uses the same material system',css.includes('.kingmastExperience .connectedRoadHud')],
  ['Playwright UI test script is configured',pkg.scripts?.['test:ui']==='playwright test'],
  ['production start script is configured for UI verification',pkg.scripts?.start==='next start'],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  for(const [name] of failed)console.error(`UI RULE FAIL: ${name}`);
  process.exit(1);
}
for(const [name] of checks)console.log(`UI RULE PASS: ${name}`);
