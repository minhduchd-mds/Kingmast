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
  const mapFallback=page.locator('.kingmastNativeMap').first();
  await expect(mapFallback).toBeVisible();
  const mapBackground=await mapFallback.evaluate((node)=>getComputedStyle(node).backgroundColor);
  expect(rgbAverage(mapBackground)).toBeGreaterThan(220);
}

test.describe('KINGMAST appearance material regression',()=>{
  test('Auto daytime keeps cockpit, dock and driver-assist rail in one light material family',async({page})=>{
    await openReturningHmi(page,'auto',true);
    await expect(page.locator('.kingmastExperience')).toHaveClass(/ambient-day/);
    await expect(page.locator('main.appShell')).toHaveClass(/theme-auto/);

    const cockpitBackground=await page.locator('.v5Cockpit').evaluate((node)=>getComputedStyle(node).backgroundImage);
    expect(cockpitBackground).toContain('255, 255, 255');

    const dockBackground=await page.getByTestId('driver-action-dock').evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(dockBackground)).toBeGreaterThan(220);

    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toBeVisible();
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

    const railBackground=await page.getByTestId('driver-capability-rail').evaluate((node)=>getComputedStyle(node).backgroundColor);
    expect(rgbAverage(railBackground)).toBeLessThan(80);
  });
});
