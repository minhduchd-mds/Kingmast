import {describe,expect,it} from 'vitest';
import {RealtimeLinkAccumulator} from '@kingmast/contracts/realtime-health';

describe('RealtimeLinkAccumulator',()=>{
  it('tracks bounded latency buckets without retaining unbounded histories',()=>{
    const link=new RealtimeLinkAccumulator();
    link.recordConnectAttempt();link.recordConnected();
    for(let index=0;index<10_000;index+=1){
      const serverAt=1_000_000+index*20;
      const clientAt=serverAt+(index%600);
      const result=link.observeTelemetry({serverEnvelopeAtMs:serverAt,ingressAtMs:serverAt-5,clientAtMs:clientAt,session:'ecu-a:boot-a',sequence:index});
      expect(result.accepted).toBe(true);
    }
    const snapshot=link.snapshot();
    expect(snapshot.messages).toBe(10_000);
    expect(snapshot.serverToClient.samples).toBe(10_000);
    expect(Object.keys(snapshot.serverToClient.buckets)).toEqual(['le20','le50','le100','le250','le500','gt500']);
    expect(snapshot.serverToClient.maxMs).toBeLessThanOrEqual(599);
    expect('history' in snapshot).toBe(false);
  });

  it('rejects sequence regression inside the same device boot session',()=>{
    const link=new RealtimeLinkAccumulator();
    expect(link.observeTelemetry({serverEnvelopeAtMs:1_000,ingressAtMs:990,clientAtMs:1_010,session:'ecu-a:boot-a',sequence:12}).accepted).toBe(true);
    expect(link.observeTelemetry({serverEnvelopeAtMs:1_020,ingressAtMs:1_015,clientAtMs:1_030,session:'ecu-a:boot-a',sequence:11}).accepted).toBe(false);
    expect(link.snapshot().sequenceRegressions).toBe(1);
  });

  it('accepts a sequence reset only when the device boot session changes',()=>{
    const link=new RealtimeLinkAccumulator();
    link.observeTelemetry({serverEnvelopeAtMs:1_000,ingressAtMs:990,clientAtMs:1_010,session:'ecu-a:boot-a',sequence:200});
    const changed=link.observeTelemetry({serverEnvelopeAtMs:2_000,ingressAtMs:1_990,clientAtMs:2_015,session:'ecu-a:boot-b',sequence:0});
    expect(changed).toMatchObject({accepted:true,sessionChanged:true});
    expect(link.snapshot().sessionChanges).toBe(1);
    expect(link.snapshot().lastSequence).toBe(0);
  });

  it('records disconnect and successful reconnect epochs separately',()=>{
    const link=new RealtimeLinkAccumulator();
    link.recordConnectAttempt();link.recordConnected();link.recordDisconnect();link.recordConnectAttempt();link.recordConnected();
    expect(link.snapshot()).toMatchObject({connectAttempts:2,successfulConnections:2,reconnects:1,disconnects:1});
  });

  it('records malformed and clock-anomalous observations without negative latency',()=>{
    const link=new RealtimeLinkAccumulator();
    expect(link.observeTelemetry({serverEnvelopeAtMs:2_000,ingressAtMs:null,clientAtMs:1_900,session:'ecu-a:boot-a',sequence:1}).accepted).toBe(true);
    expect(link.snapshot().clockAnomalies).toBe(1);
    expect(link.snapshot().serverToClient.samples).toBe(0);
    expect(link.observeTelemetry({serverEnvelopeAtMs:Number.NaN,ingressAtMs:null,clientAtMs:2_100,session:'ecu-a:boot-a',sequence:2}).accepted).toBe(false);
    expect(link.snapshot().malformedMessages).toBe(1);
  });
});
