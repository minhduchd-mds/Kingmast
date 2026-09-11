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
