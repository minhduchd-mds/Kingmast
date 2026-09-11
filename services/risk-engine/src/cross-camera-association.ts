import type { PerceptionObjectTrack } from '@kingmast/contracts/nextgen';

const MAX_BEARING_DELTA_DEG=8;
const MAX_DISTANCE_DELTA_M=3;
const MIN_CONFIDENCE=.55;

function angularDelta(a:number,b:number){const delta=Math.abs(a-b)%360;return Math.min(delta,360-delta);}
function canAssociate(a:PerceptionObjectTrack,b:PerceptionObjectTrack){
  if(a.kind!==b.kind||a.confidence<MIN_CONFIDENCE||b.confidence<MIN_CONFIDENCE)return false;
  if(a.relativeBearingDeg===null||b.relativeBearingDeg===null)return false;
  if(angularDelta(a.relativeBearingDeg,b.relativeBearingDeg)>MAX_BEARING_DELTA_DEG)return false;
  if(a.distanceM!==null&&b.distanceM!==null&&Math.abs(a.distanceM-b.distanceM)>MAX_DISTANCE_DELTA_M)return false;
  if(Math.abs(a.lastSeenAtMs-b.lastSeenAtMs)>250)return false;
  return true;
}

function weighted(values:Array<{value:number;weight:number}>){const weight=values.reduce((sum,item)=>sum+item.weight,0);return weight>0?values.reduce((sum,item)=>sum+item.value*item.weight,0)/weight:0;}

function mergeGroup(group:PerceptionObjectTrack[]):PerceptionObjectTrack{
  const best=[...group].sort((a,b)=>b.confidence-a.confidence)[0]!;
  const bearings=group.filter((item)=>item.relativeBearingDeg!==null).map((item)=>({value:item.relativeBearingDeg!,weight:item.confidence}));
  const distances=group.filter((item)=>item.distanceM!==null).map((item)=>({value:item.distanceM!,weight:item.confidence}));
  const relativeSpeeds=group.filter((item)=>item.relativeSpeedMps!==null).map((item)=>({value:item.relativeSpeedMps!,weight:item.confidence}));
  return{
    ...best,
    id:`surround:${group.map((item)=>item.id).sort().join('+')}`.slice(0,240),
    confidence:Math.min(.999,Math.max(...group.map((item)=>item.confidence))+.02*(group.length-1)),
    distanceM:distances.length?weighted(distances):null,
    relativeBearingDeg:bearings.length?weighted(bearings):null,
    relativeSpeedMps:relativeSpeeds.length?weighted(relativeSpeeds):null,
    firstSeenAtMs:Math.min(...group.map((item)=>item.firstSeenAtMs)),
    lastSeenAtMs:Math.max(...group.map((item)=>item.lastSeenAtMs)),
    sources:[...new Set(group.flatMap((item)=>item.sources))],
  };
}

export function associateCrossCameraTracks(tracks:PerceptionObjectTrack[]):PerceptionObjectTrack[]{
  const bounded=tracks.slice(0,512);
  const used=new Set<number>();
  const result:PerceptionObjectTrack[]=[];
  for(let i=0;i<bounded.length;i+=1){
    if(used.has(i))continue;
    const group=[bounded[i]!];used.add(i);
    for(let j=i+1;j<bounded.length;j+=1){if(!used.has(j)&&canAssociate(group[0]!,bounded[j]!)){group.push(bounded[j]!);used.add(j);}}
    result.push(group.length>1?mergeGroup(group):{...group[0]!,sources:[...group[0]!.sources]});
  }
  return result.slice(0,256);
}
