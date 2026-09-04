import type { ProductCapability } from './capability-registry';

export interface CapabilityDetail {
  driverBehavior:string;
  integrationGate:string;
  safetyBoundary:string;
  nextAction:string;
}

const PRIORITY_DETAILS:Record<string,CapabilityDetail>={
  ldw:{
    driverBehavior:'Shows a directional lane-departure advisory only when the lane model is reliable and crossing risk is imminent. An intentional same-side turn signal or hazard signal suppresses the warning.',
    integrationGate:'Calibrated front-camera lane perception must provide lane width, lateral offset, lateral velocity, heading error and confidence. The software evaluator currently gates operation below 45 km/h and below 0.72 confidence.',
    safetyBoundary:'Warning-only. KINGMAST does not steer the vehicle, apply lane-centering torque or claim lane-keeping authority.',
    nextAction:'Connect the calibrated lane-perception producer to the authenticated edge path, then validate false-positive and missed-warning rates on recorded and closed-track scenarios.',
  },
  assistant:{
    driverBehavior:'Answers short navigation, road, charging, vehicle-health and alert-explanation requests using a read-only tool allowlist and current KINGMAST context.',
    integrationGate:'A production conversation provider may be added only after tool results remain traceable to live route, telemetry and approved road-context sources. Unsupported requests must remain outside the assistant scope.',
    safetyBoundary:'No brake, steering, throttle, gear, torque or CAN-write tool exists. Deep settings remain parked-only.',
    nextAction:'Wire the read-only intent plan to live HMI context, add voice input/output behind driver-distraction limits, then evaluate Vietnamese command coverage and hallucination resistance.',
  },
  surround:{
    driverBehavior:'Provides a low-speed surround-view surface only after the native camera host confirms a valid calibrated multi-camera set.',
    integrationGate:'At least four native camera calibrations are required. Each calibration must provide a valid 3×3 homography; the current readiness evaluator treats a maximum reprojection error of 3 px or less as ready.',
    safetyBoundary:'Visualization only. A surround view never grants automated parking, steering or motion-control authority.',
    nextAction:'Integrate four synchronized native feeds, complete camera intrinsics/extrinsics calibration, measure seam quality and latency, then expose the confirmed native state to the parked/low-speed HMI.',
  },
  dms:{
    driverBehavior:'Uses a temporal attention window to distinguish attentive, distracted, prolonged-distraction, suspected drowsiness and unavailable-driver observations. It does not infer drowsiness from a single frame.',
    integrationGate:'A cabin-camera vision producer must provide reliable face visibility, eye closure, gaze-away and head-pose samples with timestamps and confidence.',
    safetyBoundary:'Advisory only. The software stores no raw cabin video in this assessment path and does not perform driver identity recognition.',
    nextAction:'Integrate the cabin model, define privacy retention policy, validate PERCLOS/gaze thresholds across lighting and eyewear conditions, then add a minimal driver-facing advisory state.',
  },
  fleet:{
    driverBehavior:'Turns safety events into explainable fleet risk summaries for parked enterprise review rather than adding more driving-screen interruptions.',
    integrationGate:'Production deployment needs tenant isolation, authenticated trip/event ingestion, retention rules and organization-specific access control around the existing scoring foundation.',
    safetyBoundary:'Fleet scoring is analytical only and must not remotely control a vehicle or silently expand personal-data collection.',
    nextAction:'Add tenant-scoped storage/API boundaries, score provenance, threshold configuration and report export after privacy and consent rules are fixed for the target fleet.',
  },
  ecall:{
    driverBehavior:'Uses an explicit emergency flow: confirmation, connecting, then connected only after a native emergency provider returns a real incident confirmation.',
    integrationGate:'A native emergency provider and verified incident identifier are mandatory. Without that provider the HMI must show unavailable and direct the driver to an alternate emergency channel.',
    safetyBoundary:'KINGMAST must never display a successful emergency connection from browser state alone and cannot silently cancel an already provider-confirmed incident.',
    nextAction:'Select the jurisdiction/OEM emergency provider, implement the native bridge, exercise failure and no-network paths, and validate wording with legal/safety stakeholders before enabling the feature.',
  },
  climate:{
    driverBehavior:'Shows climate state only when the native vehicle host confirms real HVAC telemetry and supported controls.',
    integrationGate:'Requires an OEM/native climate bridge. Browser-only state is never treated as vehicle HVAC state.',
    safetyBoundary:'No generic CAN-write or simulated HVAC authority is exposed.',
    nextAction:'Define the OEM signal/control adapter and allowlisted commands, then test degraded/unavailable states before exposing controls.',
  },
  media:{
    driverBehavior:'Shows native now-playing state with shallow driver-safe controls; deeper browsing remains parked-only.',
    integrationGate:'Requires an authenticated native media host and source/session state.',
    safetyBoundary:'No unrelated vehicle-control permission is inherited from media integration.',
    nextAction:'Connect the native media bridge and add distraction-bounded controls with unavailable/degraded fallbacks.',
  },
  phone:{
    driverBehavior:'Shows pairing/connectivity state through the native Bluetooth host and keeps pairing setup parked-only.',
    integrationGate:'Requires a native Bluetooth/phone host. This is not official Apple CarPlay and must not be represented as such.',
    safetyBoundary:'Phone connectivity cannot grant vehicle actuation authority.',
    nextAction:'Integrate the native pairing bridge, permission prompts and call-state policy, then validate parked-only setup behavior.',
  },
};

function genericDetail(item:ProductCapability):CapabilityDetail{
  if(item.state==='available')return{
    driverBehavior:`${item.note} The HMI presents this capability only from the runtime data already available to KINGMAST.`,
    integrationGate:`Keep ${item.source} healthy and observable; degraded or unavailable inputs must be reflected explicitly instead of replaced by fabricated live state.`,
    safetyBoundary:item.drivingPolicy==='parked-only'?'Parked-only interaction. Critical safety warnings remain available outside this surface.':'Driver assistance remains advisory and preserves the Level 0 warning-only boundary.',
    nextAction:'Continue regression, accessibility and degraded-state validation against the current integration.',
  };
  if(item.state==='software-ready')return{
    driverBehavior:item.note,
    integrationGate:`The software path is prepared, but production readiness still depends on confirmed ${item.source} data or deployment-specific integration.`,
    safetyBoundary:'Software readiness is not hardware readiness. The HMI must not claim the feature is live until its source is confirmed.',
    nextAction:'Complete the required provider/native/vehicle integration, then promote the state only after runtime and safety validation.',
  };
  if(item.state==='requires-integration')return{
    driverBehavior:item.note,
    integrationGate:`A native/OEM integration for ${item.source} is required before the capability can be presented as operational.`,
    safetyBoundary:'No simulated native capability, hidden write authority or optimistic success state is permitted.',
    nextAction:'Define the native contract, confirmation semantics and degraded-state behavior, then validate on target hardware.',
  };
  return{
    driverBehavior:item.note,
    integrationGate:'Research status does not imply production capability or driver availability.',
    safetyBoundary:'Research remains isolated from production vehicle-control authority.',
    nextAction:'Build a measurable prototype and safety case before considering promotion to software-ready.',
  };
}

export function capabilityDetail(item:ProductCapability):CapabilityDetail{return PRIORITY_DETAILS[item.key]??genericDetail(item);}
