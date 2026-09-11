import type { CameraCalibrationProfile,CameraMount } from '@kingmast/contracts/nextgen';

const MAX_CAMERAS=8;
const MAX_REPROJECTION_ERROR_PX=3;

function finite(value:number){return Number.isFinite(value);}
function validIntrinsics(profile:CameraCalibrationProfile){const{intrinsics}=profile;return intrinsics.widthPx>=160&&intrinsics.widthPx<=8192&&intrinsics.heightPx>=120&&intrinsics.heightPx<=8192&&finite(intrinsics.fx)&&intrinsics.fx>0&&finite(intrinsics.fy)&&intrinsics.fy>0&&finite(intrinsics.cx)&&finite(intrinsics.cy)&&intrinsics.distortion.length<=16&&intrinsics.distortion.every(finite);}
function validExtrinsics(profile:CameraCalibrationProfile){const value=profile.extrinsics;return[value.xM,value.yM,value.zM,value.rollDeg,value.pitchDeg,value.yawDeg].every(finite)&&Math.abs(value.xM)<=10&&Math.abs(value.yM)<=10&&Math.abs(value.zM)<=5&&Math.abs(value.rollDeg)<=180&&Math.abs(value.pitchDeg)<=180&&Math.abs(value.yawDeg)<=180;}

export interface CalibrationDecision {accepted:boolean;reason:'accepted'|'invalid-camera-id'|'invalid-intrinsics'|'invalid-extrinsics'|'invalid-reprojection-error'|'invalid-version'|'mount-conflict'|'capacity';}

export class CameraCalibrationRegistry{
  private readonly profiles=new Map<string,CameraCalibrationProfile>();

  validate(profile:CameraCalibrationProfile):CalibrationDecision{
    if(!profile.cameraId.trim()||profile.cameraId.length>96)return{accepted:false,reason:'invalid-camera-id'};
    if(!validIntrinsics(profile))return{accepted:false,reason:'invalid-intrinsics'};
    if(!validExtrinsics(profile))return{accepted:false,reason:'invalid-extrinsics'};
    if(!finite(profile.reprojectionErrorPx)||profile.reprojectionErrorPx<0||profile.reprojectionErrorPx>MAX_REPROJECTION_ERROR_PX)return{accepted:false,reason:'invalid-reprojection-error'};
    if(!profile.calibrationVersion.trim()||profile.calibrationVersion.length>64)return{accepted:false,reason:'invalid-version'};
    const mountOwner=[...this.profiles.values()].find((item)=>item.mount===profile.mount&&item.cameraId!==profile.cameraId);
    if(profile.mount!=='cabin'&&mountOwner)return{accepted:false,reason:'mount-conflict'};
    if(!this.profiles.has(profile.cameraId)&&this.profiles.size>=MAX_CAMERAS)return{accepted:false,reason:'capacity'};
    return{accepted:true,reason:'accepted'};
  }

  upsert(profile:CameraCalibrationProfile){const decision=this.validate(profile);if(!decision.accepted)return decision;this.profiles.set(profile.cameraId,structuredClone(profile));return decision;}
  get(cameraId:string){const value=this.profiles.get(cameraId);return value?structuredClone(value):null;}
  byMount(mount:CameraMount){const value=[...this.profiles.values()].find((item)=>item.mount===mount);return value?structuredClone(value):null;}
  list(){return[...this.profiles.values()].map((item)=>structuredClone(item)).sort((a,b)=>a.mount.localeCompare(b.mount));}
  remove(cameraId:string){return this.profiles.delete(cameraId);}
  clear(){this.profiles.clear();}
  get size(){return this.profiles.size;}
}
