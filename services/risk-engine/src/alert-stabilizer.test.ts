import { describe, expect, it } from 'vitest';
import type { LocationAlert, Severity } from '@kingmast/contracts';
import { AlertStabilizer } from './alert-stabilizer.js';

const makeAlert=(severity:Severity,timestampMs:number):LocationAlert=>({
  id:`raw-${timestampMs}`,type:'vehicle-too-close',severity,title:'Vehicle too close',message:'Close vehicle',distanceM:7,objectId:'car-1',position:{lat:21,lng:105},timestampMs,acknowledged:false,
});

describe('AlertStabilizer',()=>{
  it('keeps a stable id and prevents immediate severity downgrade',()=>{
    const stabilizer=new AlertStabilizer();
    const first=stabilizer.update([makeAlert('critical',1000)],1000)[0];
    const second=stabilizer.update([makeAlert('caution',1500)],1500)[0];
    expect(first?.id).toBe(second?.id);
    expect(second?.severity).toBe('critical');
  });

  it('holds a missing alert briefly then expires it',()=>{
    const stabilizer=new AlertStabilizer();
    stabilizer.update([makeAlert('caution',1000)],1000);
    expect(stabilizer.update([],1800)).toHaveLength(1);
    expect(stabilizer.update([],2301)).toHaveLength(0);
  });
});
