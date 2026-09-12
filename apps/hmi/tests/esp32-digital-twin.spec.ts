import {expect,test} from '@playwright/test';

test.describe('KINGMAST ESP32 WebGL digital twin',()=>{
  test.beforeEach(async({page})=>{
    await page.goto('/lab/esp32');
    await expect(page.getByTestId('esp32-simulator')).toBeVisible();
    await expect(page.getByTestId('webgl-scene')).toBeVisible();
  });

  test('creates a real WebGL context',async({page})=>{
    const available=await page.locator('canvas[aria-label="Môi trường WebGL 3D ESP32"]').evaluate((canvas)=>Boolean((canvas as HTMLCanvasElement).getContext('webgl')));
    expect(available).toBe(true);
  });

  test('buffers telemetry to microSD when Wi-Fi is lost',async({page})=>{
    await page.getByRole('button',{name:'Mất Wi‑Fi'}).click();
    await expect(page.getByText('SPOOLING',{exact:true})).toBeVisible();
    await expect(page.getByText('BUFFERED',{exact:true})).toBeVisible();
    await expect(page.getByText('ESP32 → microSD',{exact:true})).toBeVisible();
  });

  test('shows A/B rollback when the Raspberry Pi OS crashes',async({page})=>{
    await page.getByRole('button',{name:'Pi OS crash'}).click();
    await expect(page.getByText('A/B ROLLBACK',{exact:true})).toBeVisible();
    await expect(page.getByText('Rollback → known-good',{exact:true})).toBeVisible();
    await expect(page.getByText('HEALTHY',{exact:true})).toBeVisible({timeout:5000});
  });

  test('exposes an open circuit when radar terminal E2 is disconnected',async({page})=>{
    await page.getByRole('button',{name:'Rút dây radar'}).click();
    await page.getByTestId('pin-GPIO21').click();
    await expect(page.getByTestId('terminal-inspector').getByText('OPEN CIRCUIT',{exact:true})).toBeVisible();
  });

  test('supports drag-and-drop wiring from terminal E2 to a compatible GPIO pin',async({page})=>{
    await page.getByTestId('terminal-E2').dragTo(page.getByTestId('pin-GPIO22'));
    await expect(page.getByTestId('wire-message')).toHaveText('Đã nối E2 ↔ GPIO22');
    await page.getByTestId('pin-GPIO22').click();
    await expect(page.getByTestId('terminal-inspector').getByText('E2',{exact:true})).toBeVisible();
  });

  test('rejects electrically incompatible simulated wiring',async({page})=>{
    await page.getByTestId('terminal-E2').dragTo(page.getByTestId('pin-GPIO18'));
    await expect(page.getByTestId('wire-message')).toHaveText('E2 không tương thích với GPIO18');
  });

  test('keeps standby failover witness-gated after primary hardware loss',async({page})=>{
    const witness=page.getByRole('checkbox');
    await witness.uncheck();
    await page.getByRole('button',{name:'Pi chết phần cứng'}).click();
    await expect(page.getByText('Hardware offline',{exact:true})).toBeVisible();
    await witness.check();
    await expect(page.getByText('STANDBY ACTIVE',{exact:true})).toBeVisible({timeout:4000});
  });
});
