import type { DriverIdentitySignal,DriverProfile } from '@kingmast/contracts/nextgen';

const DEFAULT_FACE_CONFIRMATION_THRESHOLD=.88;

export interface DriverResolution {
  profile:DriverProfile|null;
  confidence:'high'|'medium'|'none';
  reason:'trusted-device-and-face'|'trusted-device'|'face-only-rejected'|'no-match';
}

export function resolveDriverProfile(profiles:DriverProfile[],signal:DriverIdentitySignal,faceThreshold=DEFAULT_FACE_CONFIRMATION_THRESHOLD):DriverResolution{
  const deviceProfile=signal.trustedDeviceId?profiles.find((profile)=>profile.trustedDeviceIds.includes(signal.trustedDeviceId!))??null:null;
  const faceProfile=signal.faceProfileId?profiles.find((profile)=>profile.id===signal.faceProfileId)??null:null;
  const faceStrong=faceProfile!==null&&signal.faceConfidence!==null&&Number.isFinite(signal.faceConfidence)&&signal.faceConfidence>=faceThreshold;
  if(deviceProfile&&faceStrong&&faceProfile?.id===deviceProfile.id)return{profile:deviceProfile,confidence:'high',reason:'trusted-device-and-face'};
  if(deviceProfile)return{profile:deviceProfile,confidence:'medium',reason:'trusted-device'};
  if(faceStrong)return{profile:null,confidence:'none',reason:'face-only-rejected'};
  return{profile:null,confidence:'none',reason:'no-match'};
}

export function mayUsePersonalization(profile:DriverProfile|null){return Boolean(profile?.privacy.personalization);}
export function mayPersistLocationHistory(profile:DriverProfile|null){return Boolean(profile?.privacy.locationHistory);}
export function mayPersistCameraHistory(profile:DriverProfile|null){return Boolean(profile?.privacy.cameraHistory);}

export function driverUiSnapshot(profile:DriverProfile|null){
  if(!profile||!profile.privacy.personalization)return{language:'vi' as const,theme:'auto' as const,mapZoom:14,warningVolume:70};
  return{
    language:profile.ui.language,
    theme:profile.ui.theme,
    mapZoom:Math.max(8,Math.min(20,profile.ui.mapZoom)),
    warningVolume:Math.max(0,Math.min(100,profile.ui.warningVolume)),
  };
}
