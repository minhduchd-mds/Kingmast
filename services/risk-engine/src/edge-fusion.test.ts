import { describe, expect, it } from 'vitest';
import { fuseEdgePerception, fuseEdgePerceptionDetailed } from './edge-fusion.js';

const now = 1_800_000_000_000;
const vehicle = { lat: 21.0285, lng: 105.8542, speedKmh: 42, headingDeg: 0, accuracyM: 2.5, timestampMs: now, source: 'gnss' as const };

describe('fuseEdgePerception', () => {
  it('uses radar distance and camera class for a matched pedestrian', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [{ id: 'r1', distanceM: 9, bearingDeg: 2, relativeSpeedMps: -3, confidence: 0.95, timestampMs: now }] },
      camera: { cameraId: 'front', timestampMs: now, detections: [{ id: 'c1', kind: 'person', confidence: 0.92, bearingDeg: 1, estimatedDistanceM: 10, timestampMs: now }] },
    });
    expect(objects).toHaveLength(1);
    expect(objects[0]?.kind).toBe('person');
    expect(objects[0]?.distanceM).toBe(9);
    expect(objects[0]?.source).toBe('radar-camera');
    expect(objects[0]?.severity).toBe('caution');
  });

  it('rejects stale radar frames', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now - 500, tracks: [{ id: 'r1', distanceM: 5, bearingDeg: 0, relativeSpeedMps: -5, confidence: 0.99, timestampMs: now - 500 }] },
    });
    expect(objects).toEqual([]);
  });

  it('[S8-028] rejects future-dated radar frames beyond allowed clock skew', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now + 200, tracks: [{ id: 'r1', distanceM: 5, bearingDeg: 0, relativeSpeedMps: -5, confidence: 0.99, timestampMs: now + 200 }] },
    });
    expect(objects).toEqual([]);
  });

  it('[S8-027] rejects stale individual tracks even when their enclosing frame is fresh', () => {
    const result = fuseEdgePerceptionDetailed({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [
        { id: 'fresh', distanceM: 18, bearingDeg: 0, relativeSpeedMps: -2, confidence: 0.9, timestampMs: now },
        { id: 'stale', distanceM: 6, bearingDeg: 1, relativeSpeedMps: -6, confidence: 0.99, timestampMs: now - 700 },
      ] },
    });
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]?.id).toBe('fused-fresh');
    expect(result.diagnostics.rejectedRadarObservations).toBe(1);
  });

  it('[S8-025] never reuses one camera detection to classify multiple radar tracks', () => {
    const result = fuseEdgePerceptionDetailed({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [
        { id: 'r1', distanceM: 15, bearingDeg: 0, relativeSpeedMps: -2, confidence: 0.95, timestampMs: now },
        { id: 'r2', distanceM: 17, bearingDeg: 2, relativeSpeedMps: -2, confidence: 0.94, timestampMs: now },
      ] },
      camera: { cameraId: 'front', timestampMs: now, detections: [
        { id: 'c1', kind: 'motorcycle', confidence: 0.95, bearingDeg: 1, estimatedDistanceM: 16, timestampMs: now },
      ] },
    });
    expect(result.diagnostics.matchedCount).toBe(1);
    expect(result.objects.filter((object) => object.kind === 'motorcycle')).toHaveLength(1);
    expect(result.objects.filter((object) => object.source === 'radar-only')).toHaveLength(1);
  });

  it('[S8-024] does not associate a near-bearing camera detection when range residual exceeds the gate', () => {
    const result = fuseEdgePerceptionDetailed({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [
        { id: 'r1', distanceM: 12, bearingDeg: 0, relativeSpeedMps: -2, confidence: 0.95, timestampMs: now },
      ] },
      camera: { cameraId: 'front', timestampMs: now, detections: [
        { id: 'c1', kind: 'car', confidence: 0.95, bearingDeg: 1, estimatedDistanceM: 30, timestampMs: now },
      ] },
    });
    expect(result.objects.find((object) => object.id === 'fused-r1')?.kind).toBe('unknown');
    expect(result.objects.find((object) => object.id === 'fused-r1')?.source).toBe('radar-only');
    expect(result.diagnostics.disagreementCount).toBe(1);
  });

  it('[S8-026] rejects camera/radar association when timestamps are too far apart', () => {
    const result = fuseEdgePerceptionDetailed({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [
        { id: 'r1', distanceM: 12, bearingDeg: 0, relativeSpeedMps: -2, confidence: 0.95, timestampMs: now },
      ] },
      camera: { cameraId: 'front', timestampMs: now - 150, detections: [
        { id: 'c1', kind: 'car', confidence: 0.95, bearingDeg: 1, estimatedDistanceM: 12, timestampMs: now - 150 },
      ] },
    });
    expect(result.objects.find((object) => object.id === 'fused-r1')?.kind).toBe('unknown');
    expect(result.diagnostics.matchedCount).toBe(0);
  });

  it('[S8-022] keeps radar-only targets unclassified rather than inventing a class', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs: now,
      radar: { radarId: 'front', timestampMs: now, tracks: [{ id: 'r1', distanceM: 20, bearingDeg: 0, relativeSpeedMps: -1, confidence: 0.9, timestampMs: now }] },
    });
    expect(objects[0]?.kind).toBe('unknown');
    expect(objects[0]?.source).toBe('radar-only');
  });

  it('keeps camera-only estimated distance spatial-only and never collision-critical', () => {
    const objects = fuseEdgePerception({
      vehicle,
      nowMs: now,
      camera: { cameraId: 'front', timestampMs: now, detections: [{ id: 'c1', kind: 'person', confidence: 0.98, bearingDeg: 0, estimatedDistanceM: 4, timestampMs: now }] },
    });
    expect(objects).toHaveLength(1);
    expect(objects[0]?.source).toBe('camera-only');
    expect(objects[0]?.severity).toBe('safe');
  });
});
