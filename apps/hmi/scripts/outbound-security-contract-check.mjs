import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const outbound=read('lib/outbound-security.ts');
const proxy=read('proxy.ts');
const session=read('app/api/kingmast/session/route.ts');
const alternatives=read('app/api/kingmast/live-navigation/alternatives/route.ts');
const search=read('app/api/kingmast/live-navigation/search/route.ts');
const capabilities=read('app/api/kingmast/live-navigation/capabilities/route.ts');
const failures=[];
const expect=(name,condition)=>{if(!condition)failures.push(name);};

expect('outbound policy has emergency and egress kill switches',outbound.includes('KINGMAST_EMERGENCY_LOCKDOWN')&&outbound.includes('KINGMAST_OUTBOUND_KILL_SWITCH'));
expect('outbound policy rejects credential-bearing URLs',outbound.includes('url.username || url.password'));
expect('outbound policy rejects private IP literals outside explicit local dev',outbound.includes('privateIpLiteral')&&outbound.includes('!isLocalDev'));
expect('outbound policy requires exact reviewed hostname allowlist',outbound.includes('KINGMAST_OUTBOUND_ALLOWLIST')&&outbound.includes('allowed.has(host)'));
expect('official routing and speech provider hosts are explicit',outbound.includes('routes.googleapis.com')&&outbound.includes('api.mapbox.com')&&outbound.includes('api.openai.com')&&outbound.includes('api.elevenlabs.io'));

expect('navigation route uses egress guard for Google Mapbox and OSRM',alternatives.includes("requireOutboundUrl(`${base}/directions/v2:computeRoutes`, 'navigation-google')")&&alternatives.includes("'navigation-mapbox'")&&alternatives.includes("'navigation-osrm'"));
expect('navigation route is distance bounded',alternatives.includes('MAX_ROUTE_DISTANCE_M')&&alternatives.includes('route-distance-exceeds-policy'));
expect('geocoding uses egress guard',search.includes("requireOutboundUrl(`${base}/search`, 'navigation-geocoding')"));
expect('capability report respects paid-routing policy',capabilities.includes('paidRoutingEnabled()')&&capabilities.includes("securityEnvelope: 'enforced'"));

expect('outer proxy rate-limits expensive cloud routes',proxy.includes("pathname === '/api/kingmast/tts'")&&proxy.includes("pathname === '/api/kingmast/assistant'")&&proxy.includes("pathname.startsWith('/api/kingmast/live-navigation/')")&&proxy.includes("error: 'outer-rate-limited'"));
expect('outer proxy keeps bounded rate state',proxy.includes('MAX_RATE_KEYS = 4096')&&proxy.includes('outerStore.rate.size >= MAX_RATE_KEYS'));
expect('outer proxy retains emergency lockdown',proxy.includes('KINGMAST_EMERGENCY_LOCKDOWN')&&proxy.includes('kingmast-emergency-lockdown'));
expect('production cannot use insecure session bootstrap',session.includes("process.env.NODE_ENV!=='production'&&process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1'"));

if(failures.length){
  console.error(`KINGMAST outbound security contract failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('KINGMAST outbound security contract passed: public API envelope, navigation quota protection and egress allowlists remain enforced.');
