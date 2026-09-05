import { expect,test,type Page } from '@playwright/test';

async function openReturningDriver(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

test.describe('Apple-style HMI density and progressive disclosure',()=>{
  test('wide automotive layout stays compact without shrinking touch targets',async({page})=>{
    await openReturningDriver(page,1778,900);

    const sidebar=page.locator('.hmiV5 .sidebar');
    const sidebarBox=await sidebar.boundingBox();
    expect(sidebarBox?.width??999).toBeLessThanOrEqual(170);

    const navItems=page.locator('.hmiV5 .navItem');
    const navCount=await navItems.count();
    for(let index=0;index<navCount;index++){
      const item=navItems.nth(index);
      if(!(await item.isVisible()))continue;
      const box=await item.boundingBox();
      expect(box?.height??0).toBeGreaterThanOrEqual(44);
      expect(box?.height??999).toBeLessThanOrEqual(50);
    }

    const demo=page.locator('.topbarStatus .systemReady');
    const voice=page.locator('.topbarStatus .voiceToggle');
    const demoBox=await demo.boundingBox();
    const voiceBox=await voice.boundingBox();
    expect(Math.abs((demoBox?.width??0)-(voiceBox?.width??0))).toBeLessThanOrEqual(1);
    expect(demoBox?.width??999).toBeLessThanOrEqual(128);
    expect(demoBox?.height??0).toBeGreaterThanOrEqual(44);
    expect(demoBox?.height??999).toBeLessThanOrEqual(46);

    const eyebrowDisplay=await page.locator('.hmiTopbar .eyebrow').evaluate((node)=>getComputedStyle(node).display);
    expect(eyebrowDisplay).toBe('none');

    const dock=page.getByTestId('driver-action-dock');
    const dockBox=await dock.boundingBox();
    expect(dockBox?.width??9999).toBeLessThanOrEqual(900);
    expect(dockBox?.height??0).toBeGreaterThanOrEqual(56);
    expect(dockBox?.height??999).toBeLessThanOrEqual(70);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
  });

  test('hazard sheet is compact and exposes no more than two contextual actions',async({page})=>{
    await openReturningDriver(page,1366,768);
    const alertButton=page.getByTestId('driver-action-dock').getByRole('button',{name:/Alerts/});
    await expect(alertButton).toHaveClass(/hasAlert/,{timeout:9_000});
    await alertButton.click();

    const sheet=page.getByTestId('driver-action-sheet');
    await expect(sheet).toBeVisible();
    const sheetBox=await sheet.boundingBox();
    expect(sheetBox?.width??9999).toBeLessThanOrEqual(740);
    expect(await sheet.locator('.driverSheetActions button').count()).toBeLessThanOrEqual(2);
    await expect(sheet.getByText('Mute voice')).toHaveCount(0);
    await expect(sheet.locator('footer')).toHaveCount(0);

    const primary=sheet.locator('[data-sheet-primary="true"]');
    const primaryBox=await primary.boundingBox();
    expect(primaryBox?.height??0).toBeGreaterThanOrEqual(44);
  });

  test('short automotive display preserves density without horizontal overflow',async({page})=>{
    await openReturningDriver(page,1280,480);
    const controls=page.locator('.topbarStatus .systemReady,.topbarStatus .voiceToggle,.topbarStatus .gpsControl,.driverActionDock button');
    const count=await controls.count();
    for(let index=0;index<count;index++){
      const control=controls.nth(index);
      if(!(await control.isVisible()))continue;
      const box=await control.boundingBox();
      expect(box?.height??0).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
  });
});
