import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const live = read('components/KingmastLiveNavigation.tsx');
const cockpit = read('components/KingmastRealCockpit.tsx');
const page = read('app/esp32-live/page.tsx');
const source = `${live}\n${cockpit}`;

const required = [
  ['esp32-live mounts real navigation shell', page.includes('KingmastLiveNavigation')],
  ['real cockpit is the live shell', live.includes("import KingmastRealCockpit") && live.includes('<KingmastRealCockpit')],
  ['truth policy is explicit', cockpit.includes('REAL DATA ONLY') && cockpit.includes('Không dữ liệu giả')],
  ['missing sources render unavailable', cockpit.includes('UNAVAILABLE') && cockpit.includes('Thiếu nguồn → -- / unavailable')],
  ['gps speed preserves unavailable state', live.includes('position.coords.speed == null ? null')],
  ['gps heading preserves unavailable state', live.includes('position.coords.heading == null ? null')],
  ['traffic live depends on provider capability', live.includes('trafficLive={Boolean(capability?.liveTraffic)}')],
  ['osrm is labelled without live traffic', live.includes('OSRM · tuyến thật, không traffic live')],
  ['https does not mislabel local c3 mixed-content as offline', live.includes("window.location.protocol === 'https:'") && live.includes("setState('blocked')")],
  ['local c3 payload is reachability-only', live.includes('await response.json();') && !live.includes('distanceM') && !live.includes('ttc') && !live.includes('relativeSpeedMps')],
];

const forbidden = [
  ['fake weather', '32°C'],
  ['route simulation label', 'Route simulation'],
  ['fake trip distance', '12.4 km'],
  ['fake fuel consumption', '6.1 L/100km'],
  ['fake estimated range', '320 km'],
  ['fake speed limit', 'Giới hạn tốc độ'],
  ['fake PRND state', '<span>P</span>'],
  ['demo route label', 'ROUTE DEMO'],
  ['demo environment label', 'Demo environment'],
];

for (const [name, token] of forbidden) required.push([`live shell excludes ${name}`, !source.includes(token)]);

const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`REAL DATA RULE FAIL: ${name}`);
  process.exit(1);
}
for (const [name] of required) console.log(`REAL DATA RULE PASS: ${name}`);
