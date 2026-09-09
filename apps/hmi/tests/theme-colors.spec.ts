import { expect,test,type Locator,type Page } from '@playwright/test';

function rgbAverage(value:string){
  const match=value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if(!match)return 0;
  return (Number(match[1])+Number(match[2])+Number(match[3]))/3;
}

async function foregroundAverage(locator:Locator){
  return locator.evaluate((node)=>{
    const value=getComputedStyle(node).color;
    const match=value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
    if(!match)return 0;
    return (Number(match[1])+Number(match[2])+Number(match[3]))/3;
  });
}

async function openReturningHmi(page:Page,appearance:'auto'|'day'|'night',daytime=false){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({appearance,daytime})=>{
    localStorage.setItem('kingmast:v006:first-run-complete','1');
    localStorage.setItem('kingmast:v006:appearance',appearance);
    if(daytime){
      Date.prototype.getHours=function(){return 10;};
    }
  },{appearance,daytime});
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
  await expect(page.getByTestId('driver-action-dock')).toBeVisible();
}

async function dispatchMovingTelemetry(page:Page){
  await page.evaluate(()=>{
    const now=Date.now();
    const frame={
      sequence:1,
      vehicle:{lat:21.0285,lng:105.8542,speedKmh:36,headingDeg:0,accuracyM:2,timestampMs:now,source:'gnss' as const},
      sensors:{radarFront:'ok' as const,radarRear:'ok' as const,camera:'ok' as const,can:'ok' as const,gnssImu:'ok' as const,ecu:'ok' as const},
      objects:[],
      alerts:[],
      assist:null,
    };
    window.dispatchEvent(new CustomEvent('kingmast:telemetry',{detail:{frame,receivedAtMs:now,diagnostics:null}}));
  });
}

async function expectReadableDayDrivingCopy(page:Page){
  const selectors=[
    '.clockLabel',
    '.maneuverCopy strong',
    '.maneuverCopy small',
    '.maneuverCopy em',
    '.maneuverBanner>button',
    '.metricTile small',
    '.metricTile strong',
    '.metricTile strong em',
    '.speedUnit',
    '.roadName',
  ];
  for(const selector of selectors){
    const node=page.locator(selector).first();
    await expect(node).toBeVisible();
    expect(await foregroundAverage(node),`${selector} should use dark readable copy in Day mode`).toBeLessThan(145);
  }

  // 1366x768 now intentionally gives the full driving canvas to Surround View.
  // The surrounding cockpit remains light in Day mode while the spatial scene
  // stays dark for sensor/object contrast; the legacy side mini-map is no longer
  // a required surface at this automotive viewport.
  const surround=page.getByTestId('surround-spatial-layer');
  await expect(surround).toBeVisible();
  const scene=page.locator('.v5RoadScene');
  await expect(scene).toBeVisible();
  const sceneBackground=await scene.evaluate((node)=>getComputedStyle(node).backgroundColor);
  expect(rgbAverage(sceneBackground)).toBeLessThan(80);
}

test.describe('KINGMAST appearance material regression',()=>{
  test('Auto daytime keeps cockpit, dock and moving assist rail in one light material family',async({page})=>{
    await openReturningHmi(page,'auto',true);
    await expect(page.locator('.kingmastExperience')).toHaveClass(/ambient-day/);
    await expect(page.locator('main.appShell')).toHaveClass(/theme-auto/);

    const cockpitBackground=await page.locator('.v5Cockpit').evaluate((node)=>getComputedStyle(node).backgroundImage);
    expect(cockpitBackground).toContain('255, 255, 255');

    const dockBackground=await page.getByTestId('driver-action-dock').evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(dockBackground)).toBeGreaterThan(220);

    await expect(page.getByTestId('driver-capability-rail')).toHaveCount(0);
    await dispatchMovingTelemetry(page);
    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveClass(/isQuiet/);
    const railBackground=await rail.evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(railBackground)).toBeGreaterThan(220);

    await expectReadableDayDrivingCopy(page);
  });

  test('explicit Day uses readable dark copy on all primary light driving surfaces',async({page})=>{
    await openReturningHmi(page,'day');
    await expect(page.locator('main.appShell')).toHaveClass(/theme-day/);
    await expectReadableDayDrivingCopy(page);
  });

  test('explicit Night keeps floating driver materials dark',async({page})=>{
    await openReturningHmi(page,'night');
    await expect(page.locator('main.appShell')).toHaveClass(/theme-night/);

    const dockBackground=await page.getByTestId('driver-action-dock').evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(dockBackground)).toBeLessThan(80);

    await expect(page.getByTestId('driver-capability-rail')).toHaveCount(0);
    await dispatchMovingTelemetry(page);
    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toBeVisible();
    const railBackground=await rail.evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(railBackground)).toBeLessThan(80);
  });
});
