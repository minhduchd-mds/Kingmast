import { expect, test } from '@playwright/test';

type Mode = 'SAFE' | 'WATCH' | 'WARNING' | 'DANGER' | 'SENSOR_LOST';

function payloadFor(mode: Mode) {
  const scenarios = {
    SAFE: { distanceM: 55, relativeSpeedMps: -1, ttc: 55, speedKph: 45, sensorOnline: true, confidence: .98 },
    WATCH: { distanceM: 24, relativeSpeedMps: -3, ttc: 8, speedKph: 50, sensorOnline: true, confidence: .95 },
    WARNING: { distanceM: 11, relativeSpeedMps: -4.5, ttc: 2.44, speedKph: 55, sensorOnline: true, confidence: .96 },
    DANGER: { distanceM: 4.2, relativeSpeedMps: -7.5, ttc: .56, speedKph: 62, sensorOnline: true, confidence: .99 },
    SENSOR_LOST: { distanceM: -1, relativeSpeedMps: 0, ttc: -1, speedKph: 40, sensorOnline: false, confidence: 0 },
  }[mode];

  return {
    deviceId: 'KINGMAST-C3-TEST-01',
    chip: 'ESP32-C3',
    mode,
    bearingDeg: 3,
    risk: mode,
    uplinkOnline: true,
    clients: 1,
    uptime: 120,
    ...scenarios,
  };
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

test('cockpit consumes C3 telemetry and switches bench danger/degraded states', async ({ page }) => {
  let mode: Mode = 'SAFE';
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.route('http://192.168.4.1/api/telemetry', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(payloadFor(mode)) });
  });
  await page.route(/http:\/\/192\.168\.4\.1\/api\/mode\?state=.*/, async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state')?.toUpperCase() as Mode | undefined;
    if (state === 'SAFE' || state === 'WATCH' || state === 'WARNING' || state === 'DANGER' || state === 'SENSOR_LOST') mode = state;
    await route.fulfill({ status: 200, contentType: 'text/plain', headers: corsHeaders, body: 'OK' });
  });

  await page.goto('/esp32-live');
  await expect(page.getByTestId('kingmast-cockpit-ultra')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId('kingmast-drive-scene')).toHaveAttribute('data-risk', 'SAFE');
  await expect(page.getByText('C3 bench connected')).toBeVisible();

  await page.getByRole('button', { name: 'Thiết bị' }).click();
  await page.getByRole('button', { name: 'DANGER' }).click();
  await expect(page.getByTestId('kingmast-drive-scene')).toHaveAttribute('data-risk', 'DANGER', { timeout: 3_000 });
  await expect(page.getByText('XE PHÍA TRƯỚC · NGUY CƠ CAO')).toBeVisible();
  await expect(page.getByText('4.2 m').first()).toBeVisible();

  await page.getByRole('button', { name: 'Thiết bị' }).click();
  await page.getByRole('button', { name: 'SENSOR LOST' }).click();
  await expect(page.getByTestId('kingmast-drive-scene')).toHaveAttribute('data-risk', 'SENSOR LOST', { timeout: 3_000 });
  await expect(page.getByText('FRONT SENSOR UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('Không hiển thị khoảng cách hoặc TTC giả khi cảm biến mất.')).toBeVisible();
});
