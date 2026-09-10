import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const layout=read('app/layout.tsx');
const startup=read('components/StartupExperience.tsx');
const motion=read('lib/motion.ts');
const performanceCss=read('app/hmi-performance.css');
const autoAppearanceCss=read('app/hmi-auto-appearance-fix.css');
const evidence=read('tests/performance-evidence.spec.ts');

const checks=[
  ['performance override is loaded last',layout.includes("import './hmi-assistant.css';\nimport './hmi-auto-appearance-fix.css';\nimport './hmi-performance.css';")],
  ['auto daytime floating materials remain light',autoAppearanceCss.includes('.kingmastExperience.ambient-day')&&autoAppearanceCss.includes('.hmiV5.theme-auto')&&autoAppearanceCss.includes('.driverActionDock')&&autoAppearanceCss.includes('.driverCapabilityRail')],
  ['startup readiness comes from native device health',startup.includes('useDeviceHealth')&&startup.includes("device.id === 'gnss-imu'")&&startup.includes("device.id === id")],
  ['browser startup makes no hardware readiness claim',startup.includes('Hardware readiness is not claimed in browser preview')&&startup.includes('No hardware readiness claim')],
  ['host timeout does not fabricate ready state',startup.includes('Host not ready')&&startup.includes('Device status remains unresolved')],
  ['cockpit numeric values avoid multi-frame React interpolation',!motion.includes('Math.pow(1 - progress')&&!motion.includes('if (progress < 1) frame = requestAnimationFrame(tick)')],
  ['permanent driver surfaces avoid backdrop sampling',performanceCss.includes('.hmiV5 .sidebar')&&performanceCss.includes('.driverActionDock')&&performanceCss.includes('backdrop-filter:none!important')],
  ['surround continuous motion stays transform-only',performanceCss.includes('kingmastTargetTransformOnly')&&performanceCss.includes('translate3d(-50%,-50%,0)')],
  ['performance evidence follows package version',evidence.includes('productVersion:hmiPackage.version')&&!evidence.includes("productVersion:'0.0.6'")],
  ['performance evidence has a 60fps-oriented target',evidence.includes("name:'60fps-oriented-browser-target'")&&evidence.includes('frameP50Ms:20')&&evidence.includes('target60FpsClaimed:false')],
  ['headless evidence separates target from CI scheduling tolerance',evidence.includes('minObservedCadenceHz')&&evidence.includes('steadyStateWarmupMs')&&evidence.includes('targetHardwareQualified:false')],
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){for(const[name]of failed)console.error(`PERFORMANCE CONTRACT FAIL: ${name}`);process.exit(1);}
for(const[name]of checks)console.log(`PERFORMANCE CONTRACT PASS: ${name}`);
