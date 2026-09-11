import { z } from 'zod';

export const NextgenGeoPointSchema=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
export const DriverPrivacySchema=z.object({locationHistory:z.boolean(),cameraHistory:z.boolean(),personalization:z.boolean(),diagnosticsUpload:z.boolean()});
export const DriverUiSchema=z.object({language:z.enum(['vi','en']),theme:z.enum(['auto','light','dark']),mapZoom:z.number().min(8).max(20),warningVolume:z.number().min(0).max(100)});
export const DriverProfileSchema=z.object({id:z.string().trim().min(1).max(96),displayName:z.string().trim().min(1).max(120),role:z.enum(['owner','admin','driver','guest','valet','service']),trustedDeviceIds:z.array(z.string().trim().min(1).max(128)).max(16),privacy:DriverPrivacySchema,ui:DriverUiSchema,home:NextgenGeoPointSchema.nullable(),work:NextgenGeoPointSchema.nullable(),updatedAtMs:z.number().int().positive()});
export const DriverIdentitySignalSchema=z.object({trustedDeviceId:z.string().trim().min(1).max(128).nullable(),faceProfileId:z.string().trim().min(1).max(96).nullable(),faceConfidence:z.number().min(0).max(1).nullable(),observedAtMs:z.number().int().positive()});
export const VehiclePermissionSchema=z.enum(['vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','settings.safety.change','diagnostics.read']);
export const VehicleAccessGrantSchema=z.object({grantId:z.string().trim().min(1).max(128),vehicleId:z.string().trim().min(1).max(96),profileId:z.string().trim().min(1).max(96),role:z.enum(['owner','admin','driver','guest','valet','service']),permissions:z.array(VehiclePermissionSchema).max(32),validFromMs:z.number().int().positive(),validUntilMs:z.number().int().positive().nullable(),issuedByProfileId:z.string().trim().min(1).max(96),revokedAtMs:z.number().int().positive().nullable()});
export const AccessDecisionSchema=z.object({vehicleId:z.string().trim().min(1).max(96),profileId:z.string().trim().min(1).max(96),permission:VehiclePermissionSchema,nowMs:z.number().int().positive().optional()});
export const ProfileQuerySchema=z.object({profileId:z.string().trim().min(1).max(96)});
export const VehicleQuerySchema=z.object({vehicleId:z.string().trim().min(1).max(96).optional()});
export const AuditQuerySchema=z.object({limit:z.coerce.number().int().min(1).max(200).default(100)});

export const CameraMountSchema=z.enum(['front','rear','left','right','cabin']);
export const CameraIntrinsicsSchema=z.object({widthPx:z.number().int().min(160).max(8192),heightPx:z.number().int().min(120).max(8192),fx:z.number().positive().max(20_000),fy:z.number().positive().max(20_000),cx:z.number().min(-20_000).max(20_000),cy:z.number().min(-20_000).max(20_000),distortion:z.array(z.number().finite()).max(16)});
export const CameraExtrinsicsSchema=z.object({xM:z.number().min(-10).max(10),yM:z.number().min(-10).max(10),zM:z.number().min(-5).max(5),rollDeg:z.number().min(-180).max(180),pitchDeg:z.number().min(-180).max(180),yawDeg:z.number().min(-180).max(180)});
export const CameraCalibrationProfileSchema=z.object({cameraId:z.string().trim().min(1).max(96),mount:CameraMountSchema,intrinsics:CameraIntrinsicsSchema,extrinsics:CameraExtrinsicsSchema,calibratedAtMs:z.number().int().positive(),reprojectionErrorPx:z.number().min(0).max(3),calibrationVersion:z.string().trim().min(1).max(64)});
