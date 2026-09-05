import { expect,test,type Page } from '@playwright/test';

async function openHmi(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

async function boxes(page:Page,selector:string){
  return page.locator(selector).evaluateAll((nodes)=>nodes.filter((node)=>{
    const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden';
  }).map((node)=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height,radius:getComputedStyle(node).borderRadius};}));
}

test.describe('KINGMAST unified front-end control system',()=>{
  test('Navigate header utilities have identical compact button geometry',async({page})=>{
    await openHmi(page,1717,900);
    await page.getByRole('button',{name:'Navigate',exact:true}).first().click();
    await expect(page.getByRole('heading',{name:'Navigate'})).toBeVisible();

    const controls=page.locator('.topbarStatus .systemReady,.topbarStatus .voiceToggle,.topbarStatus .gpsControl');
    await expect(controls).toHaveCount(3);
    const dimensions=await boxes(page,'.topbarStatus .systemReady,.topbarStatus .voiceToggle,.topbarStatus .gpsControl');
    expect(dimensions).toHaveLength(3);
    expect(Math.max(...dimensions.map((item)=>item.width))-Math.min(...dimensions.map((item)=>item.width))).toBeLessThanOrEqual(1);
    expect(Math.max(...dimensions.map((item)=>item.height))-Math.min(...dimensions.map((item)=>item.height))).toBeLessThanOrEqual(1);
    expect(dimensions[0].width).toBeGreaterThanOrEqual(120);
    expect(dimensions[0].width).toBeLessThanOrEqual(128);
    expect(dimensions[0].height).toBeGreaterThanOrEqual(44);
    expect(dimensions[0].height).toBeLessThanOrEqual(46);
    expect(new Set(dimensions.map((item)=>item.radius)).size).toBe(1);

    const icons=page.locator('.topbarStatus .systemReady svg,.topbarStatus .voiceToggle svg,.topbarStatus .gpsControl svg');
    const iconSizes=await icons.evaluateAll((nodes)=>nodes.map((node)=>{const rect=node.getBoundingClientRect();return[rect.width,rect.height];}));
    expect(iconSizes.every(([width,height])=>Math.abs(width-17)<=.5&&Math.abs(height-17)<=.5)).toBe(true);
  });

  test('common automotive controls remain aligned by family and meet the touch floor',async({page})=>{
    await openHmi(page,1366,768);

    const nav=await boxes(page,'.navItem');
    expect(nav.length).toBeGreaterThanOrEqual(3);
    expect(nav.every((item)=>item.height>=44&&item.height<=50)).toBe(true);

    const dock=await boxes(page,'.driverActionDock button');
    expect(dock.length).toBe(5);
    expect(Math.max(...dock.map((item)=>item.height))-Math.min(...dock.map((item)=>item.height))).toBeLessThanOrEqual(1);
    expect(dock.every((item)=>item.height>=48&&item.height<=52)).toBe(true);

    const routeButton=page.locator('.maneuverBanner>button');
    await expect(routeButton).toBeVisible();
    const routeHeight=(await routeButton.boundingBox())?.height??0;
    expect(routeHeight).toBeGreaterThanOrEqual(44);
    expect(routeHeight).toBeLessThanOrEqual(52);

    const sectionAction=page.locator('.sectionTitle button').first();
    if(await sectionAction.isVisible())expect((await sectionAction.boundingBox())?.height??0).toBeGreaterThanOrEqual(44);
  });

  test('compact automotive panel preserves equal header utilities without horizontal overflow',async({page})=>{
    await openHmi(page,1280,480);
    await page.getByRole('button',{name:'Navigate',exact:true}).first().click();
    const dimensions=await boxes(page,'.topbarStatus .systemReady,.topbarStatus .voiceToggle,.topbarStatus .gpsControl');
    expect(dimensions).toHaveLength(3);
    expect(Math.max(...dimensions.map((item)=>item.width))-Math.min(...dimensions.map((item)=>item.width))).toBeLessThanOrEqual(1);
    expect(Math.max(...dimensions.map((item)=>item.height))-Math.min(...dimensions.map((item)=>item.height))).toBeLessThanOrEqual(1);
    expect(dimensions.every((item)=>item.height>=44&&item.height<=46)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  });
});
