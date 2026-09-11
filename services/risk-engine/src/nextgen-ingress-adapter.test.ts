import {describe,expect,it} from 'vitest';
import {NextgenRuntime} from './nextgen-runtime.js';
import {ingestLegacyDms,ingestLegacyFrontCamera} from './nextgen-ingress-adapter.js';

const NOW=1_800_000_000_000;

describe('nextgen ingress adapter',()=>{
  it('maps legacy DMS samples into advisory-only driver state',()=>{
    const runtime=new NextgenRuntime();
    const result=ingestLegacyDms(runtime,{timestampMs:NOW-100,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95},NOW);
    expect(result.state).toBe('attentive');
    expect(result.advisoryOnly).toBe(true);
    expect(runtime.snapshot().controlAuthority).toBe('none');
  });

  it('does not promote uncalibrated legacy camera ingress to trusted alerts',()=>{
    const runtime=new NextgenRuntime();
    const result=ingestLegacyFrontCamera(runtime,'vehicle-1',{cameraId:'legacy-front',timestampMs:NOW-100,detections:[{id:'car-1',kind:'car',confidence:.95,bearingDeg:0,estimatedDistanceM:15,timestampMs:NOW-100}]},NOW);
    expect(result.trust.eligibleForAlerts).toBe(false);
    expect(result.trust.reasons).toContain('camera-input-untrusted');
  });
});
