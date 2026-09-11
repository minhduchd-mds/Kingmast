import {z} from 'zod';

const GeoPoint=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
const DataSource=z.enum(['camera','radar','gnss','imu','map','authorized-provider','trusted-device','simulator']);
const ObjectKind=z.enum(['person','car','motorcycle','bicycle','truck','bus','animal','barrier','debris','unknown']);
const ObjectTrack=z.object({id:z.string().trim().min(1).max(128),kind:ObjectKind,confidence:z.number().min(0).max(1),distanceM:z.number().min(0).max(500).nullable(),relativeBearingDeg:z.number().min(-180).max(180).nullable(),relativeSpeedMps:z.number().min(-100).max(100).nullable(),position:GeoPoint.nullable(),firstSeenAtMs:z.number().int().positive(),lastSeenAtMs:z.number().int().positive(),sources:z.array(DataSource).min(1).max(8)});
const Lane=z.object({laneId:z.string().trim().min(1).max(96),side:z.enum(['left','right','center','unknown']),confidence:z.number().min(0).max(1),curvature1pm:z.number().min(-1).max(1).nullable(),distanceToBoundaryM:z.number().min(-20).max(20).nullable()});
const FreeSpace=z.object({bearingStartDeg:z.number().min(-180).max(180),bearingEndDeg:z.number().min(-180).max(180),freeDistanceM:z.number().min(0).max(250),confidence:z.number().min(0).max(1)});
export const CalibratedCameraObservationSchema=z.object({cameraId:z.string().trim().min(1).max(96),capturedAtMs:z.number().int().positive(),receivedAtMs:z.number().int().positive(),sequence:z.number().int().nonnegative(),detections:z.array(ObjectTrack).max(256),lanes:z.array(Lane).max(16),freeSpace:z.array(FreeSpace).max(72)});
export const CalibratedCameraIngressSchema=z.object({vehicleId:z.string().trim().min(1).max(96),observation:CalibratedCameraObservationSchema});

const TrafficControlKind=z.enum(['speed-limit','stop-sign','yield-sign','traffic-light']);
const TrafficSignalState=z.enum(['red','amber','green','flashing','off','unknown']);
export const TrafficControlObservationSchema=z.object({id:z.string().trim().min(1).max(128),cameraId:z.string().trim().min(1).max(96),kind:TrafficControlKind,speedLimitKmh:z.number().int().min(5).max(180).nullable(),signalState:TrafficSignalState.nullable(),confidence:z.number().min(0).max(1),relativeBearingDeg:z.number().min(-180).max(180),estimatedDistanceM:z.number().min(0).max(250).nullable(),capturedAtMs:z.number().int().positive(),receivedAtMs:z.number().int().positive()});
export const TrafficControlIngressSchema=z.object({vehicleId:z.string().trim().min(1).max(96),observation:TrafficControlObservationSchema});
