import type { UnitSystem } from './use-driver-profile';

const KMH_TO_MPH=0.6213711922;
const M_TO_FT=3.280839895;
const M_TO_MI=0.0006213711922;

export interface UnitValue { value:string; unit:string; text:string; }

export function speedValue(speedKmh:number,units:UnitSystem){return units==='imperial'?Math.round(speedKmh*KMH_TO_MPH):Math.round(speedKmh);}
export function speedUnit(units:UnitSystem){return units==='imperial'?'mph':'km/h';}
export function speedText(speedKmh:number,units:UnitSystem){return`${speedValue(speedKmh,units)} ${speedUnit(units)}`;}

export function distanceValue(distanceM:number,units:UnitSystem):UnitValue{
  const safe=Math.max(0,distanceM);
  if(units==='metric'){
    if(safe<1_000){const value=String(Math.round(safe<100?Math.round(safe):Math.round(safe/10)*10));return{value,unit:'m',text:`${value} m`};}
    const value=(safe/1_000).toFixed(safe<10_000?1:0);return{value,unit:'km',text:`${value} km`};
  }
  const miles=safe*M_TO_MI;
  if(miles<0.1){const feet=safe*M_TO_FT;const rounded=feet<100?Math.round(feet):Math.round(feet/10)*10;const value=String(rounded);return{value,unit:'ft',text:`${value} ft`};}
  const value=miles.toFixed(miles<10?1:0);return{value,unit:'mi',text:`${value} mi`};
}

export function formatDistance(distanceM:number,units:UnitSystem){return distanceValue(distanceM,units).text;}
export function formatAccuracy(distanceM:number,units:UnitSystem){return distanceValue(distanceM,units);}

export function convertMetricText(message:string,units:UnitSystem){
  if(units==='metric')return message;
  return message
    .replace(/(\d+(?:\.\d+)?)\s*km\/h\b/gi,(_,value)=>speedText(Number(value),units))
    .replace(/(\d+(?:\.\d+)?)\s*km\b/gi,(_,value)=>formatDistance(Number(value)*1_000,units))
    .replace(/(\d+(?:\.\d+)?)\s*m\b/gi,(_,value)=>formatDistance(Number(value),units));
}

export function speedAriaLabel(speedKmh:number|null,units:UnitSystem){
  if(speedKmh===null)return'Speed limit unavailable';
  const value=speedValue(speedKmh,units);
  return units==='imperial'?`Speed limit ${value} miles per hour`:`Speed limit ${value} kilometers per hour`;
}
