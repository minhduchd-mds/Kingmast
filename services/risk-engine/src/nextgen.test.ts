import { describe,expect,it } from 'vitest';
import type { DriverProfile,NavigationHorizonEvent,PerceptionFrame,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { LatestFrameBuffer } from './camera-frame-buffer.js';
import { resolveDriverProfile } from './driver-profile.js';
import { buildNavigationHorizon } from './navigation-horizon.js';
import { assessPerceptionTrust } from './perception-trust.js';
import { compactPreservingEnds } from './route-compaction.js';
import { evaluateVehicleAccess } from './vehicle-access.js';

const NOW=1_900_000_000_000;

function horizonEvent(id:string,distanceM:number,capturedAtMs=NOW):NavigationHorizonEvent{return{
  id,kind:'hazard',title:id,position:{lat:21,lng:105},distanceM,severity:'caution',advisorySpeedKmh:40,curvature1pm:null,gradePct:null,confidence:.9,
  evidence:{source:'map',capturedAtMs,receivedAtMs:capturedAtMs,confidence:.9,health:'ok'},
};}

function profile():DriverProfile{return{
  id:'driver-owner',displayName:'Owner',role:'owner',trustedDeviceIds:['phone-1'],
  privacy:{locationHistory:true,cameraHistory:false,personalization:true,diagnosticsUpload:false},
  ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:65},home:null,work:null,updatedAtMs:NOW,
};}

describe('KINGMAST next-gen foundations',()=>{
  it('keeps fresh horizon events in distance order and rejects stale evidence',()=>{
    const horizon=buildNavigationHorizon({vehicleId:'KM-1',origin:{lat:21,lng:105},headingDeg:370,lookaheadM:1000,nowMs:NOW,events:[horizonEvent('far',800),horizonEvent('near',120),horizonEvent('stale',20,NOW-90_000)]});
    expect(horizon.events.map((event)=>event.id)).toEqual(['near','far']);
    expect(horizon.headingDeg).toBe(10);
  });

  it('never treats demo perception or duplicate cameras as live trusted perception',()=>{
    const camera={cameraId:'front-1',mount:'front' as const,calibration:'calibrated' as const,synchronized:true,frameAgeMs:20,reprojectionErrorPx:1,health:'ok' as const};
    const frame:PerceptionFrame={vehicleId:'KM-1',frameId:'f-1',mode:'demo',capturedAtMs:NOW-20,receivedAtMs:NOW,cameras:[camera,camera],objects:[],lanes:[],freeSpace:[],degradedReasons:[]};
    const result=assessPerceptionTrust(frame,NOW);
    expect(result.eligibleForAlerts).toBe(false);
    expect(result.reasons).toContain('mode-demo-not-live');
    expect(result.reasons).toContain('duplicate-camera-id');
    expect(result.uniqueCameraCount).toBe(1);
  });

  it('drops old camera work instead of allowing inference backlog to grow',()=>{
    const buffer=new LatestFrameBuffer<number>(2);
    buffer.push(1);buffer.push(2);buffer.push(3);
    expect(buffer.takeLatest()).toBe(3);
    expect(buffer.stats()).toEqual({accepted:3,dropped:2,consumed:1,queued:0});
  });

  it('uses a trusted device as primary identity and face only as confirmation',()=>{
    const resolved=resolveDriverProfile([profile()],{trustedDeviceId:'phone-1',faceProfileId:'driver-owner',faceConfidence:.96,observedAtMs:NOW});
    expect(resolved.profile?.id).toBe('driver-owner');
    expect(resolved.confidence).toBe('high');
    const faceOnly=resolveDriverProfile([profile()],{trustedDeviceId:null,faceProfileId:'driver-owner',faceConfidence:.99,observedAtMs:NOW});
    expect(faceOnly.profile).toBeNull();
    expect(faceOnly.reason).toBe('face-only-rejected');
  });

  it('applies role restrictions even when a grant accidentally lists a sensitive permission',()=>{
    const grant:VehicleAccessGrant={grantId:'g1',vehicleId:'KM-1',profileId:'valet-1',role:'valet',permissions:['vehicle.use','trip.history.read'],validFromMs:NOW-1000,validUntilMs:NOW+1000,issuedByProfileId:'owner',revokedAtMs:null};
    expect(evaluateVehicleAccess({grant,vehicleId:'KM-1',profileId:'valet-1',permission:'vehicle.use',nowMs:NOW}).allowed).toBe(true);
    expect(evaluateVehicleAccess({grant,vehicleId:'KM-1',profileId:'valet-1',permission:'trip.history.read',nowMs:NOW}).reason).toBe('role-restricted');
  });

  it('compacts long routes without losing the first or final sample',()=>{
    const source=Array.from({length:2001},(_,index)=>index);
    const compacted=compactPreservingEnds(source,1800);
    expect(compacted).toHaveLength(1800);
    expect(compacted[0]).toBe(0);
    expect(compacted.at(-1)).toBe(2000);
  });
});
