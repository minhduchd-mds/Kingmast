import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=(path)=>readFileSync(resolve(root,path),'utf8');

const capabilityRail=read('components/DriverCapabilityRail.tsx');
const capabilityCss=read('app/hmi-driver-capabilities.css');
const attentionCss=read('app/hmi-attention.css');
const densityCss=read('app/hmi-apple-density.css');
const interaction=read('components/DriverInteractionLayer.tsx');
const shell=read('components/KingmastV006.tsx');
const uiTests=read('tests/ui.spec.ts');

const checks=[
  {
    id:'HF-STRUCT-001',
    requirement:'warning-only authority remains explicit',
    passed:capabilityRail.includes('Warning-only · no vehicle control')&&capabilityRail.includes('Read-only assistant'),
    evidence:['components/DriverCapabilityRail.tsx'],
  },
  {
    id:'HF-STRUCT-002',
    requirement:'critical hazard suppresses secondary capability status',
    passed:capabilityCss.includes('body:has(.hmiV5.severity-critical) .driverCapabilityRail'),
    evidence:['app/hmi-driver-capabilities.css'],
  },
  {
    id:'HF-STRUCT-003',
    requirement:'Drive preserves one primary textual warning owner',
    passed:attentionCss.includes('only full textual warning surface in Drive')&&attentionCss.includes('body:has(.hmiV5.severity-critical) .connectedRoadHud'),
    evidence:['app/hmi-attention.css'],
  },
  {
    id:'HF-STRUCT-004',
    requirement:'automotive touch targets preserve 44px floor and 48px primary actions',
    passed:densityCss.includes('min-height:44px')&&densityCss.includes('.driverActionDock button')&&densityCss.includes('min-height:48px'),
    evidence:['app/hmi-apple-density.css'],
  },
  {
    id:'HF-STRUCT-005',
    requirement:'reduced-motion accommodation remains present',
    passed:densityCss.includes('@media(prefers-reduced-motion:reduce)')&&attentionCss.includes('@media(prefers-reduced-motion:reduce)'),
    evidence:['app/hmi-apple-density.css','app/hmi-attention.css'],
  },
  {
    id:'HF-STRUCT-006',
    requirement:'increased-contrast accommodation remains present',
    passed:densityCss.includes('@media(prefers-contrast:more)')&&attentionCss.includes('@media(prefers-contrast:more)'),
    evidence:['app/hmi-apple-density.css','app/hmi-attention.css'],
  },
  {
    id:'HF-STRUCT-007',
    requirement:'modal action sheets return focus',
    passed:interaction.includes('aria-modal="true"')&&interaction.includes('returnFocusRef.current?.focus()'),
    evidence:['components/DriverInteractionLayer.tsx'],
  },
  {
    id:'HF-STRUCT-008',
    requirement:'moving capability presentation is attention-filtered',
    passed:capabilityRail.includes('attentionRelevant')&&capabilityRail.includes('.slice(0,2)')&&capabilityRail.includes('Quiet monitoring'),
    evidence:['components/DriverCapabilityRail.tsx'],
  },
  {
    id:'HF-STRUCT-009',
    requirement:'live telemetry loss never silently becomes simulator truth',
    passed:shell.includes('KINGMAST will not substitute simulator road context over a live vehicle session'),
    evidence:['components/KingmastV006.tsx'],
  },
  {
    id:'HF-STRUCT-010',
    requirement:'automotive-class viewport regression remains encoded',
    passed:uiTests.includes('1366')&&uiTests.includes('768')&&uiTests.includes('1920')&&uiTests.includes('720')&&uiTests.includes('1280')&&uiTests.includes('480'),
    evidence:['tests/ui.spec.ts'],
  },
];

const failed=checks.filter((check)=>!check.passed);
const report={
  schema:'kingmast-hmi-human-factors-evidence/v1',
  generatedAt:new Date().toISOString(),
  controlAuthority:'none',
  qualificationClaim:'ci-structural-only-not-user-study',
  humanFactorsValidated:false,
  userStudyEvidence:false,
  viewports:['1366x768','1920x720','1280x480'],
  structuralCheckCount:checks.length,
  passedStructuralChecks:checks.length-failed.length,
  failedStructuralChecks:failed.length,
  allStructuralChecksPassed:failed.length===0,
  checks,
  limitations:[
    'No measured glance-duration evidence is produced by this CI check.',
    'No driver comprehension, workload, distraction or error-rate study is claimed.',
    'No target-display luminance, viewing-angle, touch-latency or closed-track qualification is claimed.',
  ],
};

process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
if(failed.length)process.exitCode=1;
