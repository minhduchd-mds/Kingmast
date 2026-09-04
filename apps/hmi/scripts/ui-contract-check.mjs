import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const has=(path,text)=>existsSync(resolve(root,path))&&read(path).includes(text);
const pkg=JSON.parse(read('package.json'));
const layout=read('app/layout.tsx');
const settings=read('components/HmiSettingsPanel.tsx');
const shell=read('components/KingmastV006.tsx');
const cockpit=read('components/KingmastV5.tsx');
const interaction=read('components/DriverInteractionLayer.tsx');
const driverCapabilities=read('components/DriverCapabilityRail.tsx');
const capabilityCenter=read('components/CapabilityCenter.tsx');
const capabilityRegistry=read('lib/capability-registry.ts');
const connectedRoad=read('lib/connected-road.ts');
const preferences=read('lib/use-hmi-preferences.ts');
const driverProfile=read('lib/use-driver-profile.ts');
const units=read('lib/units.ts');
const lifecycle=read('lib/use-system-lifecycle.ts');
const roadEvents=read('lib/road-event-presentation.ts');

const checks=[
  ['development version remains 0.0.6',pkg.version==='0.0.6'],
  ['Apple-inspired base layer is loaded',layout.includes("import './hmi-apple.css';")],
  ['capability design layer is loaded',layout.includes("import './hmi-capabilities.css';")],
  ['driver-facing capability rail is loaded',layout.includes("import './hmi-driver-capabilities.css';")&&layout.includes('DriverCapabilityRail')&&layout.includes('<DriverCapabilityRail/>')],
  ['startup layer remains present',has('components/StartupExperience.tsx','Warning-only assistance')&&has('components/StartupExperience.tsx','aria-live="polite"')],
  ['first-run keeps warning-only authority',has('components/FirstRunExperience.tsx','Critical collision and vulnerable-road-user warnings always stay active')],
  ['critical warnings cannot be disabled',settings.includes('cannot be disabled in KINGMAST')&&settings.includes('Always on')],
  ['optional advisories require explicit confirmation',settings.includes('Turn off optional road advisories?')&&settings.includes('Turn off advisories')],
  ['camera warning calls out local law',settings.includes('subject to local law')],
  ['settings use parked progressive disclosure',settings.includes("'capabilities'")&&settings.includes('Vehicle & updates')&&settings.includes('role="tablist"')],
  ['36 capability center is parked inside settings',settings.includes('<CapabilityCenter/>')&&capabilityCenter.includes('36 capabilities · one safety-first platform')],
  ['capability registry covers exactly 36 numbered capabilities',(capabilityRegistry.match(/\{id:\d+,key:/g)??[]).length===36],
  ['capability states distinguish integration truth',capabilityRegistry.includes("'requires-integration'")&&capabilityRegistry.includes("'software-ready'")],
  ['capability center preserves warning-only authority',capabilityCenter.includes('No brake, steering, throttle, gear, torque or CAN write authority')],
  ['driver capability rail covers LDW DMS AI and 360',['ldw','dms','assistant','surround'].every((key)=>driverCapabilities.includes(`key:'${key}'`))],
  ['driver capability rail is status-only and truthful',driverCapabilities.includes('Warning-only · no vehicle control')&&driverCapabilities.includes('Read-only assistant')&&driverCapabilities.includes('calibration required')&&!driverCapabilities.includes('<button')],
  ['short displays shed the secondary driver capability rail',has('app/hmi-driver-capabilities.css','@media(max-height:560px)')&&has('app/hmi-driver-capabilities.css','display:none!important')],
  ['critical hazard visually suppresses secondary capability rail',has('app/hmi-driver-capabilities.css','body:has(.hmiV5.severity-critical) .driverCapabilityRail')],
  ['driver quick actions remain compact',interaction.includes('driverActionDock')&&interaction.includes('<span>Camera</span>')&&interaction.includes('<span>Alerts</span>')],
  ['driver action sheets are modal with focus return',interaction.includes('aria-modal="true"')&&interaction.includes('returnFocusRef.current?.focus()')],
  ['temporary voice mute preserves visual safety warnings',interaction.includes('Voice muted for 5 minutes')&&interaction.includes('Critical visual safety warnings remain active')],
  ['live telemetry is never silently replaced by simulation',shell.includes('KINGMAST will not substitute simulator road context over a live vehicle session')],
  ['offline mode explicitly preserves on-vehicle warnings',shell.includes('Offline mode')&&shell.includes('Primary on-vehicle warnings remain active')],
  ['sensor loss is explicit',cockpit.includes('data-testid="sensor-loss-warning"')],
  ['parked tools are locked while moving',cockpit.includes('Available while parked')&&cockpit.includes('canUseParkedTools')],
  ['driver-facing unit conversion remains atomic',cockpit.includes('speedUnit(units)')&&interaction.includes('formatDistance(props.camera.distanceM,units)')&&units.includes('KMH_TO_MPH')],
  ['profile restores reduced motion and contrast',driverProfile.includes('root.dataset.kingmastMotion')&&driverProfile.includes('root.dataset.kingmastContrast')],
  ['preference state synchronizes across HMI',preferences.includes("EVENT_NAME = 'kingmast:hmi-preferences'")],
  ['connected-road polling can be disabled',connectedRoad.includes('enabled=true')&&connectedRoad.includes('vehicle!==null&&enabled')],
  ['roadwork lane topology presentation remains present',roadEvents.includes("kind:'roadwork'")&&roadEvents.includes('preferredLaneIndexes')],
  ['SPaT countdown sanity guard remains present',roadEvents.includes('movement.minEndTimeMs-nowMs<120_000')],
  ['emergency advisory requires approach confidence',roadEvents.includes("item.approach==='approaching'")&&roadEvents.includes('item.confidence>=.65')],
  ['reduced motion exists across capability and motion layers',has('app/hmi-motion.css','@media(prefers-reduced-motion:reduce)')&&has('app/hmi-capabilities.css','@media(prefers-reduced-motion:reduce)')&&has('app/hmi-driver-capabilities.css','@media(prefers-reduced-motion:reduce)')],
  ['high contrast capability styling exists',has('app/hmi-capabilities.css','@media(prefers-contrast:more)')&&has('app/hmi-driver-capabilities.css','@media(prefers-contrast:more)')],
  ['52px automotive touch token remains present',has('app/hmi-apple.css','--apple-touch-target:52px')],
  ['56px quick action targets remain present',has('app/hmi-interactions.css','min-height:56px')],
  ['Playwright UI test script remains configured',pkg.scripts?.['test:ui']==='playwright test'],
  ['production start script remains configured',pkg.scripts?.start==='next start'],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){for(const[name]of failed)console.error(`UI RULE FAIL: ${name}`);process.exit(1);}
for(const[name]of checks)console.log(`UI RULE PASS: ${name}`);
