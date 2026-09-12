import {readFileSync} from 'node:fs';

const server=readFileSync('services/risk-engine/src/server.ts','utf8');
const envelope=readFileSync('apps/hmi/lib/security-envelope.ts','utf8');
const navigation=readFileSync('apps/hmi/app/api/kingmast/live-navigation/alternatives/route.ts','utf8');
const geocoding=readFileSync('apps/hmi/app/api/kingmast/live-navigation/search/route.ts','utf8');
const envelopeDoc=readFileSync('docs/SECURITY_ENVELOPE.md','utf8');
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

expect('HMI security envelope is fail closed',
  envelope.includes("enabled('KINGMAST_SECURITY_ENVELOPE_ENABLED', true)")&&
  envelope.includes("enabled('KINGMAST_NAV_AUTH_REQUIRED', true)")&&
  envelope.includes("KINGMAST_EMERGENCY_LOCKDOWN")&&
  envelope.includes("status: 401")&&
  envelope.includes("status: 429")
);
expect('navigation capability is short lived and replay resistant',
  envelope.includes("x-kingmast-capability")&&
  envelope.includes('15 * 60_000')&&
  envelope.includes('timingSafeEqual')&&
  envelope.includes('capabilityReplay')
);
expect('paid routing requires explicit enable kill switch and bounded quota',
  envelope.includes("enabled('KINGMAST_PAID_ROUTING_ENABLED')")&&
  envelope.includes("enabled('KINGMAST_NAV_KILL_SWITCH')")&&
  envelope.includes("KINGMAST_NAV_DAILY_PAID_LIMIT")&&
  envelope.includes('consumePaidRoutingQuota')
);
expect('navigation alternatives are envelope protected',
  navigation.includes("admitNavigationRequest(request, 'navigation:route')")&&
  navigation.includes('paidRoutingEnabled()')&&
  navigation.includes('consumePaidRoutingQuota()')&&
  navigation.includes('securityEnvelopeHeaders')
);
expect('geocoding search is envelope protected',
  geocoding.includes("admitNavigationRequest(request, 'navigation:search')")&&
  geocoding.includes('securityEnvelopeHeaders')
);
expect('paid map credentials remain server-side only',
  navigation.includes('process.env.GOOGLE_ROUTES_API_KEY')&&
  navigation.includes('process.env.MAPBOX_ACCESS_TOKEN')&&
  !navigation.includes('NEXT_PUBLIC_GOOGLE')&&
  !navigation.includes('NEXT_PUBLIC_MAPBOX')
);
expect('security envelope documents hardware read-only vehicle boundary',
  envelopeDoc.includes('Hardware read-only vehicle gateway')&&
  envelopeDoc.includes('Internet/API compromise must not create a path')&&
  envelopeDoc.includes('Observe -> Analyze -> Warn')
);

if(failures.length){
  console.error(`KINGMAST route/security-envelope policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`KINGMAST route/security-envelope policy passed for ${routes} explicit Fastify routes plus protected HMI navigation/geocoding boundaries.`);
