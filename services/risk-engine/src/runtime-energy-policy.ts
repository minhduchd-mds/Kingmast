export type EnergyMode='normal'|'efficient'|'critical-battery';
export interface RuntimeEnergyPolicy{
  mode:EnergyMode;
  safetyPerceptionRatePct:100;
  radarRatePct:100;
  criticalWarningRatePct:100;
  mapRefreshMultiplier:number;
  trafficRefreshMultiplier:number;
  analyticsUploadMode:'realtime'|'batched';
  nonCriticalMotion:'full'|'reduced';
  mediaArtworkRefresh:'normal'|'reduced';
  reason:string;
}

export function runtimeEnergyPolicy(input:{batteryPct:number;charging:boolean;driverSelectedEfficient:boolean}):RuntimeEnergyPolicy{
  const battery=Math.max(0,Math.min(100,input.batteryPct));
  const mode:EnergyMode=!input.charging&&battery<=12?'critical-battery':input.driverSelectedEfficient?'efficient':'normal';
  if(mode==='normal')return{mode,safetyPerceptionRatePct:100,radarRatePct:100,criticalWarningRatePct:100,mapRefreshMultiplier:1,trafficRefreshMultiplier:1,analyticsUploadMode:'realtime',nonCriticalMotion:'full',mediaArtworkRefresh:'normal',reason:'normal-resource-policy'};
  if(mode==='efficient')return{mode,safetyPerceptionRatePct:100,radarRatePct:100,criticalWarningRatePct:100,mapRefreshMultiplier:2,trafficRefreshMultiplier:2,analyticsUploadMode:'batched',nonCriticalMotion:'reduced',mediaArtworkRefresh:'reduced',reason:'non-safety-work-reduced'};
  return{mode,safetyPerceptionRatePct:100,radarRatePct:100,criticalWarningRatePct:100,mapRefreshMultiplier:3,trafficRefreshMultiplier:4,analyticsUploadMode:'batched',nonCriticalMotion:'reduced',mediaArtworkRefresh:'reduced',reason:'critical-battery-non-safety-work-reduced'};
}
