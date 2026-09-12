import { expect, test } from '@playwright/test';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

test('real live shell treats ESP32-C3 as reachability only and never fabricates radar danger data', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.route('http://192.168.4.1/api/telemetry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        deviceId: 'KINGMAST-C3-TEST-01',
        chip: 'ESP32-C3',
        mode: 'DANGER',
        distanceM: 4.2,
        relativeSpeedMps: -7.5,
        ttc: 0.56,
        speedKph: 62,
        sensorOnline: true,
        confidence: 0.99,
        bearingDeg: 3,
        risk: 'DANGER',
        uplinkOnline: true,
        clients: 1,
        uptime: 120,
      }),
    });
  });

  await page.goto('/esp32-live');
  await expect(page.getByTestId('kingmast-real-cockpit')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('C3 LIVE').first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Không có detection vật lý')).toBeVisible();
  await expect(page.getByText('4.2 m')).toHaveCount(0);
  await expect(page.getByText('XE PHÍA TRƯỚC · NGUY CƠ CAO')).toHaveCount(0);

  await page.getByRole('button', { name: 'Cảnh báo' }).click();
  await expect(page.getByText('Chưa có cảnh báo cảm biến thật')).toBeVisible();

  await page.getByRole('button', { name: 'Vật thể' }).click();
  await expect(page.getByText('Không có nguồn phát hiện vật thể thật')).toBeVisible();
});
