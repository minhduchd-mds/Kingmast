import {expect,test} from '@playwright/test';

test.describe('KINGMAST ESP32 digital twin',()=>{
  test.beforeEach(async({page})=>{
    await page.goto('/lab/esp32');
    await expect(page.getByTestId('esp32-simulator')).toBeVisible();
  });

  test('buffers telemetry to microSD when Wi-Fi is lost',async({page})=>{
    await page.getByRole('button',{name:'Mất Wi‑Fi'}).click();
    await expect(page.getByText('SPOOLING')).toBeVisible();
    await expect(page.getByText('BUFFERED')).toBeVisible();
    await expect(page.getByText('ESP32 → microSD')).toBeVisible();
  });

  test('shows A/B rollback when the Raspberry Pi OS crashes',async({page})=>{
    await page.getByRole('button',{name:'Pi OS crash'}).click();
    await expect(page.getByText('A/B ROLLBACK')).toBeVisible();
    await expect(page.getByText('Rollback → known-good')).toBeVisible();
    await expect(page.getByText('HEALTHY')).toBeVisible({timeout:5000});
  });

  test('exposes an open circuit when radar terminal E2 is disconnected',async({page})=>{
    await page.getByRole('button',{name:'Rút dây radar'}).click();
    await page.getByTestId('terminal-block').getByRole('button',{name:/E2/}).click();
    await expect(page.getByTestId('terminal-inspector').getByText('OPEN CIRCUIT')).toBeVisible();
  });

  test('keeps standby failover witness-gated after primary hardware loss',async({page})=>{
    const witness=page.getByRole('checkbox');
    await witness.uncheck();
    await page.getByRole('button',{name:'Pi chết phần cứng'}).click();
    await expect(page.getByText('OFFLINE')).toBeVisible();
    await expect(page.getByText('Hardware offline')).toBeVisible();
    await witness.check();
    await expect(page.getByText('STANDBY ACTIVE')).toBeVisible({timeout:4000});
  });
});
