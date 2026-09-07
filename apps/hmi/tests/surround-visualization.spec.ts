import { expect,test,type Page } from '@playwright/test';

async function openReturningDriver(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
  await expect(page.getByTestId('surround-spatial-layer')).toBeVisible({timeout:7_000});
}

async function hasHorizontalOverflow(page:Page){
  return page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
}

test.describe('Surround visualization v3',()=>{
  test('1366x768 prioritizes precision spatial awareness without duplicate directional badges',async({page})=>{
    await openReturningDriver(page,1366,768);

    const scene=page.locator('.v5RoadScene');
    const overlay=page.getByTestId('surround-spatial-layer');
    await expect(overlay).toHaveAttribute('data-source','simulator');
    await expect(page.getByTestId('surround-precision-grid')).toBeVisible();

    const sensorField=page.getByTestId('surround-sensor-field');
    await expect(sensorField).toBeVisible();
    await expect(sensorField.locator('i[data-sector]')).toHaveCount(4);
    await expect(sensorField.locator('.surroundScanSweep')).toBeVisible();

    const motorcycle=overlay.locator('[data-zone="right"][data-kind="motorcycle"]');
    await expect(motorcycle).toBeVisible();
    await expect(motorcycle).toHaveAttribute('data-range','near');
    await expect(motorcycle.locator('.surroundMarkerTarget')).toBeVisible();
    await expect(motorcycle.locator('.surroundMarkerRay')).toBeVisible();
    await expect(motorcycle).toContainText(/m|ft/);

    const oldBlindVisibility=await page.locator('.v5RoadScene>.blindRail.right').evaluate((node)=>getComputedStyle(node).visibility);
    expect(oldBlindVisibility).toBe('hidden');
    await expect(page.locator('.v5DriveSide')).toBeHidden();

    const sceneBox=await scene.boundingBox();
    const vehicleBox=await page.locator('.v5RoadScene .egoVehicle').boundingBox();
    expect(sceneBox).not.toBeNull();
    expect(vehicleBox).not.toBeNull();
    if(sceneBox&&vehicleBox){
      const sceneCenterX=sceneBox.x+sceneBox.width/2;
      const sceneCenterY=sceneBox.y+sceneBox.height/2;
      const vehicleCenterX=vehicleBox.x+vehicleBox.width/2;
      const vehicleCenterY=vehicleBox.y+vehicleBox.height/2;
      expect(Math.abs(vehicleCenterX-sceneCenterX)).toBeLessThan(18);
      expect(Math.abs(vehicleCenterY-sceneCenterY)).toBeLessThan(18);
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('1920x720 uses width for the surround canvas instead of extra driving cards',async({page})=>{
    await openReturningDriver(page,1920,720);
    const sceneBox=await page.locator('.v5RoadScene').boundingBox();
    expect(sceneBox?.width??0).toBeGreaterThan(1100);
    expect(sceneBox?.height??0).toBeGreaterThan(360);
    await expect(page.locator('.v5DriveSide')).toBeHidden();

    const overlay=page.getByTestId('surround-spatial-layer');
    const visibleMarkers=overlay.locator('.surroundMarker');
    expect(await visibleMarkers.count()).toBeGreaterThanOrEqual(2);
    await expect(overlay.locator('.surroundSensorField')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('1280x480 keeps the sensor field readable and sheds secondary marker copy',async({page})=>{
    await openReturningDriver(page,1280,480);
    const sceneBox=await page.locator('.v5RoadScene').boundingBox();
    expect(sceneBox?.height??0).toBeGreaterThanOrEqual(280);
    await expect(page.locator('.cockpitMetrics')).toBeHidden();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.speedLimitSign')).toBeVisible();
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();

    const overlay=page.getByTestId('surround-spatial-layer');
    await expect(overlay.locator('.surroundSensorField')).toBeVisible();
    const firstMarker=overlay.locator('.surroundMarker').first();
    await expect(firstMarker.locator('.surroundMarkerTarget')).toBeVisible();
    await expect(firstMarker.locator('.surroundMarkerCopy strong')).toBeVisible();
    await expect(firstMarker.locator('.surroundMarkerCopy small')).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('reduced motion freezes scan and danger pulse without removing spatial cues',async({page})=>{
    await openReturningDriver(page,1366,768);
    const sweep=page.locator('.surroundScanSweep');
    const nearTarget=page.locator('.surroundMarker.range-near .surroundMarkerTarget').first();
    await expect(sweep).toBeVisible();
    await expect(nearTarget).toBeVisible();
    expect(await sweep.evaluate((node)=>getComputedStyle(node).animationName)).toBe('none');
    expect(await nearTarget.evaluate((node)=>getComputedStyle(node).animationName)).toBe('none');
  });
});
