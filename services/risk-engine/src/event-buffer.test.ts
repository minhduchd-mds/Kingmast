import { describe, expect, it } from 'vitest';
import type { TelemetryFrame } from '@kingmast/contracts';
import { EdgeEventBuffer } from './event-buffer.js';

const frame:TelemetryFrame={
  sequence:1,
  vehicle:{lat:21,lng:105,speedKmh:20,headingDeg:0,accuracyM:3,timestampMs:1000,source:'gnss'},
  sensors:{radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'unavailable',gnssImu:'ok',ecu:'ok'},
  objects:[],
  alerts:[{id:'vehicle:1',type:'vehicle-too-close',severity:'caution',title:'Vehicle too close',message:'Close',distanceM:10,objectId:'1',position:{lat:21,lng:105},timestampMs:1000,acknowledged:false}],
};

describe('EdgeEventBuffer',()=>{
  it('deduplicates the same stable alert state',()=>{
    const buffer=new EdgeEventBuffer();
    buffer.ingest(frame);buffer.ingest(frame);
    expect(buffer.list()).toHaveLength(1);
  });

  it('records a severity transition as a new event',()=>{
    const buffer=new EdgeEventBuffer();
    buffer.ingest(frame);
    buffer.ingest({...frame,sequence:2,alerts:[{...frame.alerts[0]!,severity:'critical',timestampMs:1200}]});
    expect(buffer.list()).toHaveLength(2);
  });
});
