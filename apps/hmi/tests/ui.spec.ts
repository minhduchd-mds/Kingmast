import { expect, test, type Page } from '@playwright/test';

async function openHmi(page:Page,width:number,height:number,reducedMotion=true){
  await page.setViewportSize({width,height});
  if(reducedMotion)await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

async function hasHorizontalOverflow(page:Page){
  return page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
}

test.describe('KINGMAST v0.0.6 automotive HMI',()=>{
  test('startup experience is branded, calm and completes into Drive',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.goto('/');
    const startup=page.getByTestId('kingmast-startup');
    await expect(startup).toBeVisible();
    await expect(startup.getByRole('heading',{name:'KINGMAST'})).toBeVisible();
    await expect(startup.getByText('Safety systems active',{exact:false})).toBeVisible();
    await expect(startup.getByRole('status')).toBeVisible();
    await expect(page.locator('.startupProgress')).toBeVisible();
    await expect(page.locator('main.appShell')).toBeVisible({timeout:5_000});
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.speedLimitSign')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('primary navigation and driver controls keep automotive touch targets',async({page})=>{
    await openHmi(page,1366,768);
    const controls=page.locator('.navItem,.voiceToggle,.maneuverBanner>button');
    const count=await controls.count();
    expect(count).toBeGreaterThan(3);
    for(let index=0;index<count;index++){
      const control=controls.nth(index);
      if(!(await control.isVisible()))continue;
      const box=await control.boundingBox();
      expect(box?.height??0).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button',{name:'Navigate'}).click();
    await expect(page.getByRole('heading',{name:'Navigate'})).toBeVisible();
    await page.getByRole('button',{name:/Alerts/}).click();
    await expect(page.getByRole('heading',{name:'Alerts'})).toBeVisible();
  });

  test('1366x768 keeps the driving hierarchy readable without horizontal clipping',async({page})=>{
    await openHmi(page,1366,768);
    await expect(page.locator('.maneuverBanner')).toBeVisible();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.speedLimitSign')).toBeVisible();
    await expect(page.locator('.driverAlert')).toBeVisible();
    const speedFont=await page.locator('.speedValue').evaluate((node)=>parseFloat(getComputedStyle(node).fontSize));
    const alertFont=await page.locator('.driverAlert strong').evaluate((node)=>parseFloat(getComputedStyle(node).fontSize));
    expect(speedFont).toBeGreaterThanOrEqual(76);
    expect(alertFont).toBeGreaterThanOrEqual(16);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('1920x720 preserves navigation-first hierarchy on a wide automotive panel',async({page})=>{
    await openHmi(page,1920,720);
    await expect(page.locator('.v5Cockpit')).toBeVisible();
    await expect(page.locator('.v5RoadScene')).toBeVisible();
    await expect(page.locator('.driverAlert')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('1280x480 compacts secondary content instead of shrinking safety information',async({page})=>{
    await openHmi(page,1280,480);
    await expect(page.locator('.v5Cockpit')).toBeVisible();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.driverAlert')).toBeVisible();
    await expect(page.locator('.v5DriveSide')).toBeHidden();
    const alertHeight=await page.locator('.driverAlert').evaluate((node)=>parseFloat(getComputedStyle(node).minHeight));
    expect(alertHeight).toBeGreaterThanOrEqual(56);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('reduced motion skips decorative startup timing quickly',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.emulateMedia({reducedMotion:'reduce'});
    const started=Date.now();
    await page.goto('/');
    await expect(page.locator('main.appShell')).toBeVisible({timeout:2_000});
    expect(Date.now()-started).toBeLessThan(2_000);
  });
});
