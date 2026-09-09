import type { NavigationRoute } from '@kingmast/contracts';

export const ASSISTANT_NAVIGATION_REQUEST='kingmast:assistant-navigation-request';
export const ASSISTANT_NAVIGATION_RESULT='kingmast:assistant-navigation-result';

export type AssistantRoutePreference='fastest'|'avoid-traffic'|'balanced';
export interface AssistantNavigationIntent{destinationQuery:string;preference:AssistantRoutePreference;}
export interface AssistantNavigationRequestDetail{requestId:string;destinationQuery:string;preference:AssistantRoutePreference;}
export interface AssistantNavigationResultDetail{requestId:string;ok:boolean;destinationName:string|null;route:NavigationRoute|null;error:'offline'|'not-found'|'route-unavailable'|null;}

const VI_PREFIXES=[
  /^(?:kingmast[,.]?\s*)?(?:hãy\s+)?(?:tìm|chỉ|dẫn)\s+(?:cho\s+(?:tôi|mình|anh|em)\s+)?(?:đường|lộ trình|tuyến)\s+(?:đi\s+|đến\s+|tới\s+)?/iu,
  /^(?:kingmast[,.]?\s*)?(?:đường|lộ trình|tuyến)\s+(?:nhanh nhất|ít tắc nhất|đỡ tắc nhất|tránh tắc|không tắc)\s+(?:đến|tới|đi)\s+/iu,
  /^(?:kingmast[,.]?\s*)?(?:đi|đến|tới)\s+/iu,
];
const EN_PREFIXES=[
  /^(?:kingmast[,.]?\s*)?(?:find|show|give me|navigate|directions?)\s+(?:the\s+)?(?:fastest|best|least congested|traffic-free|route|way)?\s*(?:route|way)?\s*(?:to|toward|for)?\s*/iu,
  /^(?:kingmast[,.]?\s*)?(?:go|take me|navigate me)\s+to\s+/iu,
];
function fold(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();}

export function parseAssistantNavigationIntent(input:string):AssistantNavigationIntent|null{
  const value=input.replace(/\s+/g,' ').trim();if(value.length<3)return null;
  const lower=value.toLocaleLowerCase('vi'),plain=fold(value);
  const traffic=/(ít tắc|đỡ tắc|tránh tắc|không tắc|kẹt xe|ùn tắc|traffic|congestion|least congested|avoid traffic)/iu.test(lower)||/(it tac|do tac|tranh tac|khong tac|ket xe|un tac)/iu.test(plain);
  const fastest=/(nhanh nhất|nhanh hơn|fastest|quickest|best route)/iu.test(lower)||/(nhanh nhat|nhanh hon)/iu.test(plain);
  const navigationSignal=/(đường|lộ trình|tuyến|chỉ đường|dẫn đường|đi đến|đi tới|navigate|directions?|route|way to|take me)/iu.test(lower)||/(duong|lo trinh|tuyen|chi duong|dan duong|di den|di toi)/iu.test(plain);
  if(!navigationSignal)return null;
  let destination=value;
  for(const pattern of [...VI_PREFIXES,...EN_PREFIXES])destination=destination.replace(pattern,'').trim();
  destination=destination
    .replace(/^(?:nhanh nhất|ít tắc nhất|đỡ tắc nhất|tránh tắc|không tắc)\s+(?:đến|tới|đi)?\s*/iu,'')
    .replace(/\s+(?:nhanh nhất|ít tắc nhất|đỡ tắc nhất|tránh tắc|không tắc)$/iu,'')
    .replace(/[?.!,]+$/g,'').trim();
  if(destination.length<2||destination.length>120)return null;
  return{destinationQuery:destination,preference:traffic?'avoid-traffic':fastest?'fastest':'balanced'};
}

function requestId(){try{return crypto.randomUUID();}catch{return`nav-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}}

export function requestAssistantNavigation(intent:AssistantNavigationIntent,timeoutMs=9000):Promise<AssistantNavigationResultDetail>{
  const id=requestId();
  return new Promise((resolve)=>{
    let settled=false;
    const finish=(result:AssistantNavigationResultDetail)=>{if(settled)return;settled=true;window.clearTimeout(timer);window.removeEventListener(ASSISTANT_NAVIGATION_RESULT,onResult as EventListener);resolve(result);};
    const onResult=(event:Event)=>{const detail=(event as CustomEvent<AssistantNavigationResultDetail>).detail;if(detail?.requestId===id)finish(detail);};
    const timer=window.setTimeout(()=>finish({requestId:id,ok:false,destinationName:null,route:null,error:'route-unavailable'}),timeoutMs);
    window.addEventListener(ASSISTANT_NAVIGATION_RESULT,onResult as EventListener);
    const detail:AssistantNavigationRequestDetail={requestId:id,destinationQuery:intent.destinationQuery,preference:intent.preference};
    window.dispatchEvent(new CustomEvent<AssistantNavigationRequestDetail>(ASSISTANT_NAVIGATION_REQUEST,{detail}));
  });
}

export function publishAssistantNavigationResult(detail:AssistantNavigationResultDetail){
  window.dispatchEvent(new CustomEvent<AssistantNavigationResultDetail>(ASSISTANT_NAVIGATION_RESULT,{detail}));
}
