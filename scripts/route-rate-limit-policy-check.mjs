import {readFileSync} from 'node:fs';

const server=readFileSync('services/risk-engine/src/server.ts','utf8');
const failures=[];
const lines=server.split(/\r?\n/);

function expect(name,condition){if(!condition)failures.push(name);}

expect('route limiter uses bounded fixed-window state',server.includes('new BoundedFixedWindowRateLimiter(ROUTE_RATE_LIMIT_MAX_KEYS)')&&server.includes('ROUTE_RATE_LIMIT_MAX_KEYS=4_096'));
expect('global onRequest hook enforces route policy',server.includes("app.addHook('onRequest'")&&server.includes('routeRateLimiter.consume(')&&server.includes("error:'route-rate-limited'"));
expect('default route policy is finite',server.includes('DEFAULT_ROUTE_RATE_LIMIT={max:600,timeWindow:60_000}'));
expect('runtime diagnostics expose bounded route limiter posture',server.includes('routeRequests:{activeKeys:routeRateLimiter.activeKeys')&&server.includes('capacityRejected:routeRateLimiter.capacityRejected'));
expect('capabilities expose bounded route rate limiting',server.includes('boundedRouteRateLimit:true'));

let routes=0;
for(const [index,line] of lines.entries()){
  const trimmed=line.trim();
  if(!trimmed.startsWith('app.get(')&&!trimmed.startsWith('app.post('))continue;
  routes+=1;
  if(!trimmed.includes('config:{rateLimit:{max:')||!trimmed.includes('timeWindow:60_000'))failures.push(`server.ts:${index+1}: route is missing explicit Fastify rateLimit config`);
}
expect('all expected HTTP/WebSocket routes are covered',routes>=20);

for(const [index,line] of lines.entries()){
  let cursor=0;
  while(true){
    const marker='rateLimit:{max:';
    const at=line.indexOf(marker,cursor);
    if(at<0)break;
    const start=at+marker.length;
    const end=line.indexOf(',',start);
    const raw=end<0?'':line.slice(start,end).replaceAll('_','').trim();
    const max=Number(raw);
    if(!Number.isSafeInteger(max)||max<1||max>3_000)failures.push(`server.ts:${index+1}: invalid route rate limit max ${raw||'<missing>'}`);
    cursor=start;
  }
}

if(failures.length){
  console.error(`KINGMAST route rate-limit policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`KINGMAST route rate-limit policy passed for ${routes} explicit Fastify routes plus the bounded global fallback.`);
