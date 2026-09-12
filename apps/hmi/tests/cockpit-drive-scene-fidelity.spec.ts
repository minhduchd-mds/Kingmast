import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const scene = readFileSync(join(process.cwd(), 'components', 'KingmastDriveScene.tsx'), 'utf8');
const fx = readFileSync(join(process.cwd(), 'components', 'KingmastDriveSceneEnhancements.module.css'), 'utf8');

test('drive scene keeps premium projection and risk layers', () => {
  expect(scene).toContain('projectedPath');
  expect(scene).toContain('collisionEnvelope');
  expect(scene).toContain('drive-risk-meter');
  expect(scene).toContain('drive-sensor-strip');
  expect(scene).toContain('objectCount');
  expect(scene).toContain('confidence');
  expect(fx).toContain('.depthGrid');
  expect(fx).toContain('.speedStreaks');
  expect(fx).toContain('.riskCluster');
  expect(fx).toContain('.sensorHealthStrip');
});

test('premium effects still fail closed for lost front sensing', () => {
  expect(scene).toContain('sensorOnline && distance !== null ? <span className={fx.collisionEnvelope} /> : null');
  expect(scene).toContain("sensorOnline ? objectCount : '--'");
  expect(scene).toContain("sensorOnline ? `${confidence}%` : '--'");
  expect(scene).toContain('Không hiển thị khoảng cách hoặc TTC giả khi cảm biến mất.');
});

test('effect layer respects reduced motion', () => {
  expect(fx).toContain('@media(prefers-reduced-motion:reduce)');
  expect(fx).toContain('animation:none!important');
});
