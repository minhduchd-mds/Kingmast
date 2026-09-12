export type LocationPoint={lat:number;lon:number};
export type LocationCoarseningPolicy={decimalPlaces:number;allowPrecise:boolean};
export type CoarsenedLocation={status:'coarsened'|'blocked';lat:number|null;lon:number|null;reason:string;preciseRetained:false};

export function coarsenLocation(point:LocationPoint,policy:LocationCoarseningPolicy):CoarsenedLocation{
 if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||point.lat<-90||point.lat>90||point.lon<-180||point.lon>180)return{status:'blocked',lat:null,lon:null,reason:'invalid-location',preciseRetained:false};
 if(!Number.isInteger(policy.decimalPlaces)||policy.decimalPlaces<0||policy.decimalPlaces>4)return{status:'blocked',lat:null,lon:null,reason:'invalid-coarsening-policy',preciseRetained:false};
 if(policy.allowPrecise)return{status:'blocked',lat:null,lon:null,reason:'precise-export-not-supported',preciseRetained:false};
 const factor=10**policy.decimalPlaces;
 const lat=Math.round(point.lat*factor)/factor;
 const lon=Math.round(point.lon*factor)/factor;
 return{status:'coarsened',lat,lon,reason:'location-coarsened-for-export',preciseRetained:false};
}
