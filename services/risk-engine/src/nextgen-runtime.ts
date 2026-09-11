import type { NavigationHorizon,PerceptionFrame,PredictiveAdvisory,DriverIdentitySignal,DriverProfile,DriverStateAssessment,DriverStateObservation,VehiclePermission } from '@kingmast/contracts/nextgen';
import { buildPerceptionFrame,type RawPerceptionInput } from './perception-pipeline.js';
import { assessPerceptionTrust,type PerceptionTrustResult } from './perception-trust.js';
import { DriverStateEstimator } from './driver-state-estimator.js';
import { resolveDriverProfile,type DriverResolution } from './driver-profile.js';
import { ProfileMemoryStore } from './profile-memory.js';
import { VehicleAccessRegistry } from './vehicle-access-registry.js';
import { CameraPerformanceTracker } from './camera-performance.js';
import { buildPredictiveAdvisories } from './navigation-predictor.js';

export interface NextgenRuntimeSnapshot {
  perception:PerceptionFrame|null;
  perceptionTrust:PerceptionTrustResult|null;
  driver:DriverStateAssessment;
  activeProfileId:string|null;
  advisories:PredictiveAdvisory[];
  cameraPerformance:ReturnType<CameraPerformanceTracker['all']>;
  controlAuthority:'none';
}

export class NextgenRuntime{
  readonly memory=new ProfileMemoryStore();
  readonly access=new VehicleAccessRegistry();
  readonly cameraPerformance=new CameraPerformanceTracker();
  private readonly driverEstimator=new DriverStateEstimator();
  private perception:PerceptionFrame|null=null;
  private perceptionTrust:PerceptionTrustResult|null=null;
  private driver:DriverStateAssessment={state:'driver-unavailable',confidence:0,observedAtMs:null,ageMs:null,reason:'no-driver-observation',advisoryOnly:true};
  private activeProfile:DriverProfile|null=null;
  private advisories:PredictiveAdvisory[]=[];

  ingestPerception(input:RawPerceptionInput,nowMs=Date.now()){
    const frame=buildPerceptionFrame(input);
    for(const camera of frame.cameras){this.cameraPerformance.captured(camera.cameraId);this.cameraPerformance.processed(camera.cameraId,frame.capturedAtMs,frame.receivedAtMs);}
    this.perception=frame;
    this.perceptionTrust=assessPerceptionTrust(frame,nowMs);
    return{frame,trust:this.perceptionTrust};
  }

  ingestDriverObservation(observation:DriverStateObservation,nowMs=Date.now()){
    this.driver=this.driverEstimator.ingest(observation,nowMs);
    return this.driver;
  }

  resolveDriver(profiles:DriverProfile[],signal:DriverIdentitySignal):DriverResolution{
    const resolution=resolveDriverProfile(profiles,signal);
    this.activeProfile=resolution.profile;
    if(this.activeProfile&&!this.activeProfile.privacy.locationHistory)this.memory.clearLocationMemory(this.activeProfile.id);
    return resolution;
  }

  updateNavigationHorizon(horizon:NavigationHorizon,speedKmh:number|null,nowMs=Date.now()){
    this.advisories=buildPredictiveAdvisories(horizon,{speedKmh,nowMs});
    return this.advisories.map((item)=>({...item}));
  }

  authorize(vehicleId:string,permission:VehiclePermission,nowMs=Date.now()){
    if(!this.activeProfile)return{allowed:false,permission,reason:'grant-not-active' as const};
    return this.access.decide(vehicleId,this.activeProfile.id,permission,nowMs);
  }

  snapshot():NextgenRuntimeSnapshot{
    return{
      perception:this.perception?{...this.perception,cameras:this.perception.cameras.map((item)=>({...item})),objects:this.perception.objects.map((item)=>({...item,sources:[...item.sources]})),lanes:this.perception.lanes.map((item)=>({...item})),freeSpace:this.perception.freeSpace.map((item)=>({...item})),degradedReasons:[...this.perception.degradedReasons]}:null,
      perceptionTrust:this.perceptionTrust?{...this.perceptionTrust,reasons:[...this.perceptionTrust.reasons],objects:this.perceptionTrust.objects.map((item)=>({...item,sources:[...item.sources]}))}:null,
      driver:{...this.driver},
      activeProfileId:this.activeProfile?.id??null,
      advisories:this.advisories.map((item)=>({...item})),
      cameraPerformance:this.cameraPerformance.all(),
      controlAuthority:'none',
    };
  }
}
