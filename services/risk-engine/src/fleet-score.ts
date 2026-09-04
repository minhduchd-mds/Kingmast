export interface FleetSafetyMetrics{
  distanceKm:number;
  forwardCollisionWarnings:number;
  laneDepartureWarnings:number;
  overspeedSeconds:number;
  blindSpotWarnings:number;
  fatigueWarnings:number;
  vulnerableRoadUserWarnings:number;
}
export interface FleetSafetyScore{
  score:number;
  eventRatePer1000Km:number;
  penalties:{key:string;value:number;weight:number;penalty:number}[];
  grade:'A'|'B'|'C'|'D';
  traceable:true;
}

const WEIGHTS={fcw:10,ldw:4,overspeedMinutes:1.2,blindSpot:3,fatigue:8,vru:8} as const;
function rate(events:number,distanceKm:number){return distanceKm<=0?0:events/distanceKm*1000;}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}

export function calculateFleetSafetyScore(metrics:FleetSafetyMetrics):FleetSafetyScore{
  if(!Number.isFinite(metrics.distanceKm)||metrics.distanceKm<0)throw new Error('invalid-distance');
  for(const [key,value] of Object.entries(metrics))if(key!=='distanceKm'&&(!Number.isFinite(value)||value<0))throw new Error(`invalid-metric:${key}`);
  const denominator=Math.max(1,metrics.distanceKm);
  const normalized=[
    {key:'fcw',value:rate(metrics.forwardCollisionWarnings,denominator),weight:WEIGHTS.fcw},
    {key:'ldw',value:rate(metrics.laneDepartureWarnings,denominator),weight:WEIGHTS.ldw},
    {key:'overspeedMinutes',value:rate(metrics.overspeedSeconds/60,denominator),weight:WEIGHTS.overspeedMinutes},
    {key:'blindSpot',value:rate(metrics.blindSpotWarnings,denominator),weight:WEIGHTS.blindSpot},
    {key:'fatigue',value:rate(metrics.fatigueWarnings,denominator),weight:WEIGHTS.fatigue},
    {key:'vru',value:rate(metrics.vulnerableRoadUserWarnings,denominator),weight:WEIGHTS.vru},
  ];
  const penalties=normalized.map((item)=>({...item,penalty:Number(Math.min(30,item.value*item.weight).toFixed(2))}));
  const totalPenalty=penalties.reduce((sum,item)=>sum+item.penalty,0);
  const score=Math.round(clamp(100-totalPenalty,0,100));
  const totalEvents=metrics.forwardCollisionWarnings+metrics.laneDepartureWarnings+metrics.blindSpotWarnings+metrics.fatigueWarnings+metrics.vulnerableRoadUserWarnings;
  return{score,eventRatePer1000Km:Number(rate(totalEvents,denominator).toFixed(2)),penalties,grade:score>=90?'A':score>=78?'B':score>=65?'C':'D',traceable:true};
}
