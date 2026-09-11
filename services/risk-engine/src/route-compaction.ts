import type { GeoPoint,NavigationStep } from '@kingmast/contracts';

export function compactPreservingEnds<T>(items:T[],maxItems:number):T[]{
  if(!Number.isInteger(maxItems)||maxItems<2)throw new Error('max-items-must-be-at-least-two');
  if(items.length<=maxItems)return [...items];
  const result:T[]=[items[0]!];
  const interiorSlots=maxItems-2;
  const lastIndex=items.length-1;
  for(let slot=1;slot<=interiorSlots;slot++){
    const index=Math.round(slot*lastIndex/(interiorSlots+1));
    const item=items[Math.max(1,Math.min(lastIndex-1,index))];
    if(item!==undefined&&item!==result[result.length-1])result.push(item);
  }
  const last=items[lastIndex]!;
  if(result[result.length-1]!==last)result.push(last);
  return result.slice(0,maxItems-1).concat(last);
}

export function compactRouteGeometry(points:GeoPoint[],maxPoints=1_800){return compactPreservingEnds(points,maxPoints);}
export function compactNavigationSteps(steps:NavigationStep[],maxSteps=120){return compactPreservingEnds(steps,maxSteps);}
