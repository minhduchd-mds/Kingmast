import { expect,test,type Page } from '@playwright/test';

async function openReturningDriver(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

test.describe('driver-facing assistance capability rail',()=>{
  test('shows truthful LDW DMS AI and 360 status without creating control authority',async({page})=>{
    await openReturningDriver(page,1366,768);
    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toContainText('Warning-only · no vehicle control');
    await expect(rail.locator('[data-capability="ldw"]')).toContainText('LDW');
    await expect(rail.locator('[data-capability="ldw"]')).toContainText('Software ready');
    await expect(rail.locator('[data-capability="dms"]')).toContainText('DMS');
    await expect(rail.locator('[data-capability="assistant"]')).toContainText('AI assistant');
    await expect(rail.locator('[data-capability="assistant"]')).toContainText('Read-only assistant');
    await expect(rail.locator('[data-capability="surround"]')).toContainText('Camera 360');
    await expect(rail.locator('[data-capability="surround"]')).toContainText('Requires vehicle integration');
    await expect(rail.getByRole('button')).toHaveCount(0);
  });

  test('drops the secondary capability rail on short automotive displays',async({page})=>{
    await openReturningDriver(page,1280,480);
    await expect(page.getByTestId('driver-capability-rail')).toBeHidden();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.speedLimitSign')).toBeVisible();
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();
  });
});
