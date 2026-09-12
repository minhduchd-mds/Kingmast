import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const page = readFileSync(join(process.cwd(), 'app', 'esp32-live', 'page.tsx'), 'utf8');
const cockpit = readFileSync(join(process.cwd(), 'components', 'KingmastCockpitUltra.tsx'), 'utf8');
const scene = readFileSync(join(process.cwd(), 'components', 'KingmastDriveScene.tsx'), 'utf8');

test('ESP32 live page mounts the full KINGMAST cockpit', () => {
  expect(page).toContain("import KingmastCockpitUltra");
  expect(page).toContain('<KingmastCockpitUltra />');
  expect(cockpit).toContain('data-testid="kingmast-cockpit-ultra"');
  expect(scene).toContain('data-testid="kingmast-drive-scene"');
});

test('cockpit keeps the required automotive HMI surfaces and contextual panel controls', () => {
  expect(cockpit).toContain('KINGMAST');
  expect(cockpit).toContain('Thông tin nhanh');
  expect(cockpit).toContain('Vật thể');
  expect(cockpit).toContain('Thiết bị');
  expect(cockpit).toContain('Cảnh báo');
  expect(cockpit).toContain('Năng lượng');
  expect(cockpit).toContain('title="Ẩn"');
  expect(cockpit).toContain('title="Ghim"');
  expect(cockpit).toContain('setCollapsed((value) => !value)');
  expect(cockpit).toContain('ChevronUp');
  expect(cockpit).toContain('ChevronDown');
});

test('danger and degraded states stay explicit and do not invent sensor measurements', () => {
  expect(cockpit).toContain("payload.risk === 'SENSOR_LOST'");
  expect(cockpit).toContain('Không dùng số đo khoảng cách/TTC');
  expect(scene).toContain('FRONT SENSOR UNAVAILABLE');
  expect(scene).toContain('Không hiển thị khoảng cách hoặc TTC giả');
  expect(scene).toContain("distance === null ? '--'");
});

test('bench controls remain simulation-only and expose no vehicle actuation path', () => {
  expect(cockpit).toContain('BENCH SCENARIOS · chỉ thay dữ liệu mô phỏng');
  expect(cockpit).toContain('/api/mode?state=');
  expect(cockpit).not.toMatch(/fetch\([^\n]*(brake|steer|throttle|gear|torque)/i);
  expect(cockpit).not.toMatch(/onClick=.*(brake|steer|throttle|gear|torque)/i);
});
