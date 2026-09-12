import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const page = readFileSync(join(process.cwd(), 'app', 'esp32-live', 'page.tsx'), 'utf8');
const liveNavigation = readFileSync(join(process.cwd(), 'components', 'KingmastLiveNavigation.tsx'), 'utf8');
const cockpit = readFileSync(join(process.cwd(), 'components', 'KingmastRealCockpit.tsx'), 'utf8');

test('ESP32 live page mounts the real-data-only KINGMAST shell', () => {
  expect(page).toContain("import KingmastLiveNavigation");
  expect(page).toContain('<KingmastLiveNavigation />');
  expect(liveNavigation).toContain("import KingmastRealCockpit");
  expect(cockpit).toContain('data-testid="kingmast-real-cockpit"');
});

test('live shell keeps real navigation and hardware truth surfaces', () => {
  expect(liveNavigation).toContain("const C3_ENDPOINT = 'http://192.168.4.1'");
  expect(liveNavigation).toContain('/api/kingmast/live-navigation/capabilities');
  expect(liveNavigation).toContain('/api/kingmast/live-navigation/alternatives');
  expect(cockpit).toContain('REAL DATA ONLY');
  expect(cockpit).toContain('HARDWARE STATUS');
  expect(cockpit).toContain('Radar trước');
  expect(cockpit).toContain('Camera');
  expect(cockpit).toContain('UNAVAILABLE');
});

test('missing physical sensors stay unavailable instead of inheriting C3 reachability', () => {
  expect(cockpit).toContain('Không có detection vật lý');
  expect(cockpit).toContain('Radar / camera chưa nối · không dựng xe hoặc khoảng cách giả');
  expect(cockpit).toContain("props.gpsSpeedKmh == null ? '--'");
  expect(cockpit).toContain("props.gpsAccuracyM == null ? '--'");
  expect(cockpit).toContain('Không dữ liệu giả');
});

test('live navigation shell remains warning-only and exposes no vehicle actuation path', () => {
  const combined = `${liveNavigation}\n${cockpit}`;
  expect(cockpit).toContain('WARNING ONLY');
  expect(combined).not.toMatch(/fetch\([^\n]*(brake|steer|throttle|gear|torque)/i);
  expect(combined).not.toMatch(/onClick=.*(brake|steer|throttle|gear|torque)/i);
});
