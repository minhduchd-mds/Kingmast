import type {
  CameraDetection,
  CameraDetectionFrame,
  DetectedObject,
  ObjectKind,
  RadarTrack,
  RadarTrackFrame,
  RelativeZone,
  Severity,
  VehiclePosition,
} from '@kingmast/contracts';
import { projectPoint } from './geo.js';

const CAMERA_MAX_AGE_MS = 350;
const RADAR_MAX_AGE_MS = 250;
const MAX_FUTURE_SKEW_MS = 50;
const MAX_CROSS_SENSOR_SKEW_MS = 120;
const MATCH_BEARING_DEG = 9;
const MATCH_DISTANCE_M = 8;

export interface FusionDiagnostics {
  radarTrackCount: number;
  cameraDetectionCount: number;
  matchedCount: number;
  disagreementCount: number;
  maxTimestampSkewMs: number | null;
  rejectedRadarObservations: number;
  rejectedCameraObservations: number;
}

export interface FusionResult {
  objects: DetectedObject[];
  diagnostics: FusionDiagnostics;
}

interface CameraMatch {
  detection: CameraDetection;
  bearingResidualDeg: number;
  distanceResidualM: number | null;
  timestampSkewMs: number;
  score: number;
}

function angleDelta(a: number, b: number) {
  return Math.abs((((a - b) + 540) % 360) - 180);
}

function observationFresh(timestampMs: number, nowMs: number, maxAgeMs: number) {
  return Number.isFinite(timestampMs)
    && timestampMs <= nowMs + MAX_FUTURE_SKEW_MS
    && nowMs - timestampMs <= maxAgeMs;
}

function frameFresh(timestampMs: number, nowMs: number, maxAgeMs: number) {
  return observationFresh(timestampMs, nowMs, maxAgeMs);
}

function zoneForBearing(relativeBearingDeg: number): RelativeZone {
  const normalized = ((relativeBearingDeg + 540) % 360) - 180;
  if (normalized >= -18 && normalized <= 18) return 'front';
  if (normalized > 18 && normalized <= 55) return 'front-right';
  if (normalized < -18 && normalized >= -55) return 'front-left';
  if (normalized > 55 && normalized < 125) return 'right';
  if (normalized < -55 && normalized > -125) return 'left';
  return 'rear';
}

function severityFor(kind: ObjectKind, distanceM: number, confidence: number): Severity {
  if (confidence < 0.55) return 'safe';
  if (kind === 'person' || kind === 'bicycle' || kind === 'motorcycle') {
    if (distanceM <= 7) return 'critical';
    if (distanceM <= 16) return 'caution';
  }
  if (distanceM <= 8) return 'critical';
  if (distanceM <= 20) return 'caution';
  return 'safe';
}

function associationConfidence(match: CameraMatch) {
  const bearingQuality = 1 - Math.min(1, match.bearingResidualDeg / MATCH_BEARING_DEG);
  const distanceQuality = match.distanceResidualM === null
    ? 0.7
    : 1 - Math.min(1, match.distanceResidualM / MATCH_DISTANCE_M);
  const timeQuality = 1 - Math.min(1, match.timestampSkewMs / MAX_CROSS_SENSOR_SKEW_MS);
  return Math.max(0.45, 0.45 * bearingQuality + 0.35 * distanceQuality + 0.2 * timeQuality);
}

function matchCamera(track: RadarTrack, detections: CameraDetection[], usedCameraIds: Set<string>): CameraMatch | null {
  let best: CameraMatch | null = null;
  for (const detection of detections) {
    if (usedCameraIds.has(detection.id)) continue;
    const timestampSkewMs = Math.abs(track.timestampMs - detection.timestampMs);
    if (timestampSkewMs > MAX_CROSS_SENSOR_SKEW_MS) continue;

    const bearingResidualDeg = angleDelta(track.bearingDeg, detection.bearingDeg);
    if (bearingResidualDeg > MATCH_BEARING_DEG) continue;

    const distanceResidualM = detection.estimatedDistanceM === null
      ? null
      : Math.abs(track.distanceM - detection.estimatedDistanceM);
    if (distanceResidualM !== null && distanceResidualM > MATCH_DISTANCE_M) continue;

    const score = bearingResidualDeg
      + (distanceResidualM ?? MATCH_DISTANCE_M * 0.35) * 0.35
      + (timestampSkewMs / MAX_CROSS_SENSOR_SKEW_MS) * 2;
    if (!best || score < best.score) {
      best = { detection, bearingResidualDeg, distanceResidualM, timestampSkewMs, score };
    }
  }
  return best;
}

function hasConflictingNearBearingCandidate(track: RadarTrack, detections: CameraDetection[], usedCameraIds: Set<string>) {
  return detections.some((detection) => {
    if (usedCameraIds.has(detection.id)) return false;
    if (Math.abs(track.timestampMs - detection.timestampMs) > MAX_CROSS_SENSOR_SKEW_MS) return false;
    if (angleDelta(track.bearingDeg, detection.bearingDeg) > MATCH_BEARING_DEG) return false;
    return detection.estimatedDistanceM !== null
      && Math.abs(track.distanceM - detection.estimatedDistanceM) > MATCH_DISTANCE_M;
  });
}

export function fuseEdgePerceptionDetailed(input: {
  vehicle: VehiclePosition;
  camera?: CameraDetectionFrame;
  radar?: RadarTrackFrame;
  nowMs?: number;
}): FusionResult {
  const nowMs = input.nowMs ?? Date.now();
  const radarFrameValid = input.radar ? frameFresh(input.radar.timestampMs, nowMs, RADAR_MAX_AGE_MS) : false;
  const cameraFrameValid = input.camera ? frameFresh(input.camera.timestampMs, nowMs, CAMERA_MAX_AGE_MS) : false;

  const rawRadarTracks = radarFrameValid ? input.radar?.tracks ?? [] : [];
  const rawCameraDetections = cameraFrameValid ? input.camera?.detections ?? [] : [];
  const radarTracks = rawRadarTracks.filter((track) => observationFresh(track.timestampMs, nowMs, RADAR_MAX_AGE_MS));
  const cameraDetections = rawCameraDetections.filter((detection) => observationFresh(detection.timestampMs, nowMs, CAMERA_MAX_AGE_MS));

  const usedCameraIds = new Set<string>();
  const objects: DetectedObject[] = [];
  let matchedCount = 0;
  let disagreementCount = 0;
  let maxTimestampSkewMs: number | null = null;

  for (const track of radarTracks) {
    const match = matchCamera(track, cameraDetections, usedCameraIds);
    if (match) {
      usedCameraIds.add(match.detection.id);
      matchedCount += 1;
      maxTimestampSkewMs = Math.max(maxTimestampSkewMs ?? 0, match.timestampSkewMs);
    } else if (cameraDetections.length > 0 && hasConflictingNearBearingCandidate(track, cameraDetections, usedCameraIds)) {
      disagreementCount += 1;
    }

    const detection = match?.detection;
    const kind: ObjectKind = detection?.kind ?? 'unknown';
    const association = match ? associationConfidence(match) : 1;
    const confidence = Math.max(0, Math.min(1,
      detection
        ? Math.sqrt(track.confidence * detection.confidence) * association
        : track.confidence * 0.72,
    ));
    const relativeBearing = ((track.bearingDeg + 540) % 360) - 180;
    const worldBearing = (input.vehicle.headingDeg + relativeBearing + 360) % 360;
    objects.push({
      id: `fused-${track.id}`,
      kind,
      confidence,
      distanceM: track.distanceM,
      bearingDeg: worldBearing,
      zone: zoneForBearing(relativeBearing),
      severity: severityFor(kind, track.distanceM, confidence),
      relativeSpeedMps: track.relativeSpeedMps,
      position: projectPoint(input.vehicle, worldBearing, track.distanceM),
      timestampMs: Math.max(track.timestampMs, detection?.timestampMs ?? 0),
      source: detection ? 'radar-camera' : 'radar-only',
    });
  }

  for (const detection of cameraDetections) {
    if (usedCameraIds.has(detection.id) || detection.estimatedDistanceM === null || detection.confidence < 0.72) continue;
    const relativeBearing = ((detection.bearingDeg + 540) % 360) - 180;
    const worldBearing = (input.vehicle.headingDeg + relativeBearing + 360) % 360;
    const distanceM = detection.estimatedDistanceM;
    objects.push({
      id: `camera-${detection.id}`,
      kind: detection.kind,
      confidence: detection.confidence * 0.75,
      distanceM,
      bearingDeg: worldBearing,
      zone: zoneForBearing(relativeBearing),
      // Monocular/vision-estimated distance is spatial context only until the selected
      // camera + calibration + validation programme proves distance-warning performance.
      severity: 'safe',
      relativeSpeedMps: 0,
      position: projectPoint(input.vehicle, worldBearing, distanceM),
      timestampMs: detection.timestampMs,
      source: 'camera-only',
    });
  }

  return {
    objects: objects.sort((a, b) => a.distanceM - b.distanceM).slice(0, 64),
    diagnostics: {
      radarTrackCount: radarTracks.length,
      cameraDetectionCount: cameraDetections.length,
      matchedCount,
      disagreementCount,
      maxTimestampSkewMs,
      rejectedRadarObservations: rawRadarTracks.length - radarTracks.length,
      rejectedCameraObservations: rawCameraDetections.length - cameraDetections.length,
    },
  };
}

export function fuseEdgePerception(input: {
  vehicle: VehiclePosition;
  camera?: CameraDetectionFrame;
  radar?: RadarTrackFrame;
  nowMs?: number;
}): DetectedObject[] {
  return fuseEdgePerceptionDetailed(input).objects;
}
