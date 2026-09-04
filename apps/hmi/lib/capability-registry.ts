export type CapabilityState='available'|'software-ready'|'requires-integration'|'research';
export type CapabilityGroup='Safety & ADAS'|'Navigation & Connected Road'|'Vehicle & Edge'|'Connectivity & System'|'Business & Ecosystem';
export type DrivingPolicy='driving'|'parked-only'|'low-speed'|'contextual';

export interface ProductCapability{
  id:number;
  key:string;
  name:string;
  shortName:string;
  group:CapabilityGroup;
  state:CapabilityState;
  drivingPolicy:DrivingPolicy;
  source:string;
  note:string;
}

export const capabilityStateLabel:Record<CapabilityState,string>={
  available:'Available',
  'software-ready':'Software ready',
  'requires-integration':'Requires vehicle integration',
  research:'Research',
};

export const KINGMAST_CAPABILITIES:ProductCapability[]=[
  {id:1,key:'home',name:'Driver cockpit',shortName:'Home',group:'Safety & ADAS',state:'available',drivingPolicy:'driving',source:'HMI',note:'Primary driver hierarchy and warning-only cockpit.'},
  {id:2,key:'navigation',name:'Map & navigation',shortName:'Navigation',group:'Navigation & Connected Road',state:'available',drivingPolicy:'driving',source:'Map + routing',note:'MapLibre route, maneuver, ETA and alternatives.'},
  {id:3,key:'fcw',name:'Forward collision warning',shortName:'FCW',group:'Safety & ADAS',state:'available',drivingPolicy:'driving',source:'Radar + camera',note:'Gap, THW/TTC and risk advisory.'},
  {id:4,key:'ldw',name:'Lane departure warning',shortName:'LDW',group:'Safety & ADAS',state:'software-ready',drivingPolicy:'driving',source:'Front camera',note:'Temporal lane offset / time-to-line-crossing engine; production needs calibrated lane perception.'},
  {id:5,key:'bsm',name:'Blind-spot monitoring',shortName:'BSM',group:'Safety & ADAS',state:'available',drivingPolicy:'driving',source:'Fused objects',note:'Left/right blind-spot advisory.'},
  {id:6,key:'rcta',name:'Rear cross-traffic alert',shortName:'RCTA',group:'Safety & ADAS',state:'available',drivingPolicy:'low-speed',source:'Rear perception',note:'Low-speed cross-traffic advisory.'},
  {id:7,key:'vru',name:'Pedestrian / vulnerable-road-user detection',shortName:'VRU',group:'Safety & ADAS',state:'available',drivingPolicy:'driving',source:'Camera + radar',note:'Person/bicycle/motorcycle object fusion.'},
  {id:8,key:'tsr',name:'Traffic sign recognition',shortName:'Signs',group:'Safety & ADAS',state:'software-ready',drivingPolicy:'driving',source:'Vision + map',note:'Speed-sign path implemented; broader sign taxonomy remains staged.'},
  {id:9,key:'hwa',name:'Highway guidance',shortName:'Highway',group:'Safety & ADAS',state:'software-ready',drivingPolicy:'driving',source:'Navigation + lanes',note:'Advisory guidance only; no ACC/LKA authority.'},
  {id:10,key:'v2x',name:'V2X / SPaT',shortName:'V2X',group:'Navigation & Connected Road',state:'software-ready',drivingPolicy:'driving',source:'Signed provider',note:'Provider abstraction with server-side trust verification.'},
  {id:11,key:'traffic',name:'Realtime road traffic context',shortName:'Traffic',group:'Navigation & Connected Road',state:'software-ready',drivingPolicy:'driving',source:'Provider',note:'Provider-backed road context with bounded upstream calls.'},
  {id:12,key:'assistant',name:'KINGMAST AI assistant',shortName:'AI assistant',group:'Connectivity & System',state:'software-ready',drivingPolicy:'contextual',source:'Intent router',note:'Read-only explain/navigation/status tool router. No actuator tools exist.'},
  {id:13,key:'surround',name:'Surround / 360 camera',shortName:'Camera 360',group:'Vehicle & Edge',state:'requires-integration',drivingPolicy:'low-speed',source:'Native cameras',note:'Calibration and projection contracts are software-ready; physical multi-camera calibration is required.'},
  {id:14,key:'dashcam',name:'Dash camera metadata',shortName:'Dashcam',group:'Vehicle & Edge',state:'software-ready',drivingPolicy:'driving',source:'Camera edge',note:'Detection metadata path exists; full video recorder/storage remains native integration.'},
  {id:15,key:'dms',name:'Driver monitoring system',shortName:'DMS',group:'Safety & ADAS',state:'software-ready',drivingPolicy:'driving',source:'Cabin camera',note:'Temporal attention/PERCLOS/head-pose state engine; cabin vision model integration required.'},
  {id:16,key:'vehicle',name:'Vehicle status',shortName:'Vehicle',group:'Vehicle & Edge',state:'software-ready',drivingPolicy:'contextual',source:'Edge/CAN read-only',note:'Sensor health and read-only telemetry; full OEM signal catalog depends on adapter.'},
  {id:17,key:'ev',name:'EV route & charging context',shortName:'EV',group:'Vehicle & Edge',state:'software-ready',drivingPolicy:'contextual',source:'Route intelligence',note:'Energy estimate and charging-along-route context.'},
  {id:18,key:'climate',name:'Climate & comfort',shortName:'Climate',group:'Vehicle & Edge',state:'requires-integration',drivingPolicy:'contextual',source:'Native vehicle host',note:'UI contract is capability-gated; never simulates HVAC write authority.'},
  {id:19,key:'media',name:'Multimedia',shortName:'Media',group:'Connectivity & System',state:'requires-integration',drivingPolicy:'contextual',source:'Native media host',note:'Now-playing/control contract; deep browsing remains parked-only.'},
  {id:20,key:'phone',name:'Phone connectivity',shortName:'Phone',group:'Connectivity & System',state:'requires-integration',drivingPolicy:'parked-only',source:'Native Bluetooth host',note:'Pairing state contract only; not presented as official CarPlay.'},
  {id:21,key:'wifi',name:'Wi-Fi & connectivity',shortName:'Wi-Fi',group:'Connectivity & System',state:'software-ready',drivingPolicy:'parked-only',source:'Native network host',note:'Recovery UX exists; browser cannot control radio hardware.'},
  {id:22,key:'updates',name:'Signed software / firmware update',shortName:'Updates',group:'Connectivity & System',state:'software-ready',drivingPolicy:'parked-only',source:'Native update host',note:'Signed-package and rollback UX contract.'},
  {id:23,key:'calibration',name:'Sensor calibration & replacement',shortName:'Calibration',group:'Vehicle & Edge',state:'software-ready',drivingPolicy:'parked-only',source:'Native service host',note:'Service flow requires native confirmation.'},
  {id:24,key:'privacy',name:'Security & privacy controls',shortName:'Privacy',group:'Connectivity & System',state:'available',drivingPolicy:'parked-only',source:'Local profile',note:'Data minimization, opt-in and clear/delete flows.'},
  {id:25,key:'profile',name:'Driver profile & accessibility',shortName:'Profile',group:'Connectivity & System',state:'available',drivingPolicy:'parked-only',source:'Local profile',note:'Units, text scale, contrast and reduced motion restore.'},
  {id:26,key:'weather',name:'Weather & road hazards',shortName:'Weather',group:'Navigation & Connected Road',state:'software-ready',drivingPolicy:'driving',source:'Connected-road provider',note:'Provider-backed advisory with fail-closed trust.'},
  {id:27,key:'fleet',name:'Fleet risk management',shortName:'Fleet',group:'Business & Ecosystem',state:'software-ready',drivingPolicy:'parked-only',source:'Risk events',note:'Scoring/aggregation foundation is implemented; enterprise tenant UI is the next deployment layer.'},
  {id:28,key:'analytics',name:'Safety analytics & reports',shortName:'Analytics',group:'Business & Ecosystem',state:'software-ready',drivingPolicy:'parked-only',source:'Trips + events',note:'Local safety metrics exist; enterprise data warehouse remains deployment-specific.'},
  {id:29,key:'insurance',name:'Insurance / partner consent API',shortName:'Partners',group:'Business & Ecosystem',state:'software-ready',drivingPolicy:'parked-only',source:'Consent gateway',note:'Explicit scope/time-limited consent model; no silent data sharing.'},
  {id:30,key:'parked',name:'Parked mode',shortName:'Parked mode',group:'Connectivity & System',state:'available',drivingPolicy:'parked-only',source:'Vehicle state',note:'Deep configuration is gated while moving.'},
  {id:31,key:'ecosystem',name:'Signed service ecosystem',shortName:'Ecosystem',group:'Business & Ecosystem',state:'software-ready',drivingPolicy:'parked-only',source:'Manifest policy',note:'Permission model excludes brake/steer/throttle capabilities by design.'},
  {id:32,key:'settings',name:'System settings',shortName:'Settings',group:'Connectivity & System',state:'available',drivingPolicy:'parked-only',source:'HMI',note:'Progressive disclosure for assistance, connectivity, vehicle, privacy and profile.'},
  {id:33,key:'night',name:'Day / night readability',shortName:'Night mode',group:'Connectivity & System',state:'available',drivingPolicy:'driving',source:'HMI',note:'Auto/day/night with reduced motion and contrast support.'},
  {id:34,key:'energy-saving',name:'Energy-aware compute policy',shortName:'Energy saving',group:'Vehicle & Edge',state:'software-ready',drivingPolicy:'contextual',source:'Runtime policy',note:'Only non-safety refresh/work is throttled; safety perception remains full rate.'},
  {id:35,key:'ecall',name:'Emergency / eCall integration',shortName:'Emergency',group:'Connectivity & System',state:'requires-integration',drivingPolicy:'contextual',source:'Native emergency provider',note:'SOS state machine is software-ready; actual emergency-provider integration is mandatory before claiming a call was placed.'},
  {id:36,key:'notifications',name:'System notifications',shortName:'Notifications',group:'Connectivity & System',state:'available',drivingPolicy:'driving',source:'HMI',note:'Prioritized transient and critical feedback.'},
];

export const CAPABILITY_GROUPS:CapabilityGroup[]=['Safety & ADAS','Navigation & Connected Road','Vehicle & Edge','Connectivity & System','Business & Ecosystem'];

export function capabilitySummary(){return KINGMAST_CAPABILITIES.reduce((summary,item)=>{summary[item.state]+=1;return summary;},{available:0,'software-ready':0,'requires-integration':0,research:0} as Record<CapabilityState,number>);}
