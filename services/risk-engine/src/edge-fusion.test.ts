import { describe, expect, it } from 'vitest';
import { fuseEdgePerception } from './edge-fusion.js';

const now = 1_800_000_000_000;
const vehicle = { lat:21.0285, lng:105.8542, speedKmh:42, headingDeg:0, accuracyM:2.5, timestampMs:now, source:'gnss' as const };

describe('fuseEdgePerception', () => {
  it('uses radar distance and camera class for a matched pedestrian', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs:now,
      radar:{radarId:'front',timestampMs:now,tracks:[{id:'r1',distanceM:9,bearingDeg:2,relativeSpeedMps:-3,confidence:.95,timestampMs:now}]},
      camera:{cameraId:'front',timestampMs:now,detections:[{id:'c1',kind:'person',confidence:.92,bearingDeg:1,estimatedDistanceM:10,timestampMs:now}]},
    });
    expect(objects).toHaveLength(1);
    expect(objects[0]?.kind).toBe('person');
    expect(objects[0]?.distanceM).toBe(9);
    expect(objects[0]?.severity).toBe('caution');
  });

  it('rejects stale radar frames', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs:now,
      radar:{radarId:'front',timestampMs:now-500,tracks:[{id:'r1',distanceM:5,bearingDeg:0,relativeSpeedMps:-5,confidence:.99,timestampMs:now-500}]},
    });
    expect(objects).toEqual([]);
  });
});
