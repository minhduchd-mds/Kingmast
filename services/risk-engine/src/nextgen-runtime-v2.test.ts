import { describe,expect,it } from 'vitest';
import type { DriverProfile,NavigationHorizon,TrafficControlObservation,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { buildPerceptionFrame } from './perception-pipeline.js';
import { assessTrafficControlObservation,speedLimitFromVision } from './traffic-control-perception.js';
import { DriverStateEstimator } from './driver-state-estimator.js';
import { ProfileMemoryStore } from './profile-memory.js';
import { VehicleAccessRegistry } from './vehicle-access-registry.js';
import { CameraPerformanceTracker } from './camera-performance.js';
import { buildPredictiveAdvisories } from './navigation-predictor.js';
import { NextgenRuntime } from './nextgen-runtime.js';

const NOW=1_800_000_000_000;
const profile=(overrides:Partial<DriverProfile>={}):DriverProfile=>({id:'owner-1',displayName:'Owner',role:'owner',trustedDeviceIds:['phone-1'],privacy:{locationHistory:true,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:null,work:null,updatedAtMs:NOW,...overrides});

function perceptionInput(){return{vehicleId:'vehicle-1',frameId:'frame-1',mode:'live-edge' as const,capturedAtMs:NOW-80,receivedAtMs:NOW-30,cameras:[{cameraId:'front-1',mount:'front' as const,calibration:'calibrated' as const,synchronized:true,frameAgeMs:80,reprojectionErrorPx:.4,health:'ok' as const}],objects:[{id:'car-1',kind:'car' as const,confidence:.92,distanceM:16,relativeBearingDeg:2,relativeSpeedMps:-1,position:null,firstSeenAtMs:NOW-300,lastSeenAtMs:NOW-80,sources:['camera' as const]}],lanes:[{laneId:'left',side:'left' as const,confidence:.9,curvature1pm:.01,distanceToBoundaryM:1.3}],freeSpace:[{bearingStartDeg:-20,bearingEndDeg:20,freeDistanceM:14,confidence:.88}]};}

describe('next-gen perception runtime v2',()=>{
  it('marks duplicate physical camera identifiers as degraded',()=>{
    const input=perceptionInput();
    const frame=buildPerceptionFrame({...input,cameras:[...input.cameras,{...input.cameras[0]!,mount:'rear' as const}]});
    expect(frame.degradedReasons).toContain('duplicate-camera-id:front-1');
  });

  it('accepts fresh high-confidence speed signs and rejects stale ones',()=>{
    const observation:TrafficControlObservation={id:'sign-1',cameraId:'front-1',kind:'speed-limit',speedLimitKmh:50,signalState:null,confidence:.94,relativeBearingDeg:1,estimatedDistanceM:40,capturedAtMs:NOW-300,receivedAtMs:NOW-250};
    expect(assessTrafficControlObservation(observation,NOW).usable).toBe(true);
    expect(speedLimitFromVision(observation,'Road',NOW)?.currentKmh).toBe(50);
    expect(assessTrafficControlObservation({...observation,capturedAtMs:NOW-5_000},NOW).reason).toBe('stale');
  });

  it('classifies sustained gaze-away evidence as distraction',()=>{
    const estimator=new DriverStateEstimator();
    estimator.ingest({observedAtMs:NOW-500,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:42,headPitchDeg:2,confidence:.9},NOW-500);
    estimator.ingest({observedAtMs:NOW-300,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:40,headPitchDeg:3,confidence:.9},NOW-300);
    const result=estimator.ingest({observedAtMs:NOW-100,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:38,headPitchDeg:4,confidence:.9},NOW);
    expect(result.state).toBe('distracted');
    expect(result.advisoryOnly).toBe(true);
  });

  it('never stores location memory when location history is disabled',()=>{
    const memory=new ProfileMemoryStore();
    const privateProfile=profile({privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false}});
    expect(memory.rememberPlace(privateProfile,'Home',{lat:21,lng:105},NOW)).toBeNull();
    expect(memory.list(privateProfile)).toEqual([]);
  });

  it('audits allowed and denied vehicle permissions',()=>{
    const registry=new VehicleAccessRegistry();
    const grant:VehicleAccessGrant={grantId:'grant-1',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use'],validFromMs:NOW-1_000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    registry.upsert(grant);
    expect(registry.decide('vehicle-1','owner-1','vehicle.use',NOW).allowed).toBe(true);
    expect(registry.decide('vehicle-1','owner-1','users.manage',NOW).allowed).toBe(false);
    expect(registry.auditLog()).toHaveLength(2);
  });

  it('tracks bounded camera latency and dropped frames',()=>{
    const tracker=new CameraPerformanceTracker();
    tracker.captured('front');tracker.captured('front');tracker.dropped('front');tracker.processed('front',NOW-40,NOW);
    const snapshot=tracker.snapshot('front');
    expect(snapshot.capturedFrames).toBe(2);
    expect(snapshot.droppedFrames).toBe(1);
    expect(snapshot.p95LatencyMs).toBe(40);
  });

  it('raises predictive severity when speed substantially exceeds an upcoming limit',()=>{
    const horizon:NavigationHorizon={vehicleId:'vehicle-1',generatedAtMs:NOW,origin:{lat:21,lng:105},headingDeg:0,lookaheadM:1_500,coverage:'provider-backed',events:[{id:'limit-50',kind:'speed-limit',title:'50 km/h',position:null,distanceM:220,severity:'safe',advisorySpeedKmh:50,curvature1pm:null,gradePct:null,confidence:.95,evidence:{source:'map',capturedAtMs:NOW,receivedAtMs:NOW,confidence:.95,health:'ok'}}],notes:[]};
    const advisories=buildPredictiveAdvisories(horizon,{speedKmh:76,nowMs:NOW});
    expect(advisories[0]?.severity).toBe('critical');
    expect(advisories[0]?.advisoryOnly).toBe(true);
  });

  it('composes a read-only runtime with trusted-device profile resolution',()=>{
    const runtime=new NextgenRuntime();
    runtime.ingestPerception(perceptionInput(),NOW);
    const resolution=runtime.resolveDriver([profile()],{trustedDeviceId:'phone-1',faceProfileId:null,faceConfidence:null,observedAtMs:NOW});
    expect(resolution.profile?.id).toBe('owner-1');
    expect(runtime.snapshot().controlAuthority).toBe('none');
  });
});
