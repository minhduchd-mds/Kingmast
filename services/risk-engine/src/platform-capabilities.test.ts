import { describe,expect,it } from 'vitest';
import { calculateFleetSafetyScore } from './fleet-score.js';
import { consentAllows,createPartnerConsent,revokePartnerConsent } from './partner-consent.js';
import { validateServiceManifest,type ServiceManifest } from './service-manifest.js';
import { runtimeEnergyPolicy } from './runtime-energy-policy.js';
import { assessSurroundCalibration,unavailableNativeHost } from './platform-capabilities.js';
import { beginEmergencyConnection,confirmEmergencyConnected,initialEmergencySession,requestEmergencyConfirmation } from './emergency-support.js';

describe('platform capability foundations',()=>{
  it('produces a traceable fleet safety score',()=>{
    const result=calculateFleetSafetyScore({distanceKm:1000,forwardCollisionWarnings:2,laneDepartureWarnings:4,overspeedSeconds:120,blindSpotWarnings:1,fatigueWarnings:0,vulnerableRoadUserWarnings:0});
    expect(result.traceable).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.penalties.length).toBe(6);
  });
  it('requires explicit partner consent and supports revocation',()=>{
    const consent=createPartnerConsent({partnerId:'insurer-a',scopes:['safety-score.read'],grantedAtMs:1000,expiresAtMs:2000,explicit:true});
    expect(consentAllows(consent,'safety-score.read',1500)).toBe(true);
    expect(consentAllows(revokePartnerConsent(consent,1600),'safety-score.read',1700)).toBe(false);
    expect(()=>createPartnerConsent({partnerId:'x',scopes:['trip-summary.read'],grantedAtMs:1000,expiresAtMs:2000,explicit:false})).toThrow('explicit-consent-required');
  });
  it('rejects ecosystem actuator permissions and insecure entrypoints',()=>{
    const unsafe={schemaVersion:1,id:'unsafe.service',name:'Unsafe',version:'1.0.0',permissions:['brake.write'],entrypoint:'http://example.com',signature:'12345678901234567890123456789012'} as unknown as ServiceManifest;
    const result=validateServiceManifest(unsafe);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/permission-not-allowed|https-entrypoint-required/);
  });
  it('never throttles safety perception in energy-saving modes',()=>{
    const policy=runtimeEnergyPolicy({batteryPct:7,charging:false,driverSelectedEfficient:true});
    expect(policy.mode).toBe('critical-battery');
    expect(policy.safetyPerceptionRatePct).toBe(100);
    expect(policy.radarRatePct).toBe(100);
    expect(policy.mapRefreshMultiplier).toBeGreaterThan(1);
  });
  it('does not claim surround view readiness without four calibrated cameras',()=>{
    expect(assessSurroundCalibration([]).state).toBe('requires-calibration');
    expect(unavailableNativeHost().climate.nativeConfirmed).toBe(false);
  });
  it('only reports emergency connected after native provider confirmation',()=>{
    const confirming=requestEmergencyConfirmation(initialEmergencySession(1000),1100);
    const unavailable=beginEmergencyConnection(confirming,null,1200);
    expect(unavailable.state).toBe('unavailable');
    const connecting=beginEmergencyConnection(confirming,'provider-a',1200);
    expect(connecting.nativeConfirmed).toBe(false);
    const connected=confirmEmergencyConnected(connecting,'incident-123',1300);
    expect(connected.state).toBe('connected');
    expect(connected.nativeConfirmed).toBe(true);
  });
});
