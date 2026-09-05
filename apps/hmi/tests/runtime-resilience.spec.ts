import { expect,test,type Page } from '@playwright/test';

async function primeReturningDriver(page:Page){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
}

async function openDrive(page:Page){
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:10_000});
  await expect(page.getByText('Ready to navigate')).toBeVisible();
}

test.describe('KINGMAST production runtime resilience',()=>{
  test('demo deployment does not hammer viewer-session endpoint when no realtime backend is configured',async({page})=>{
    const sessionRequests:string[]=[];
    page.on('request',(request)=>{if(new URL(request.url()).pathname==='/api/kingmast/session')sessionRequests.push(request.url());});
    await primeReturningDriver(page);
    await openDrive(page);
    await page.waitForTimeout(2_500);
    expect(sessionRequests).toEqual([]);
  });

  test('malformed legacy navigation storage is discarded instead of crashing the client tree',async({page})=>{
    const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));
    await primeReturningDriver(page);
    await page.addInitScript(()=>{
      const broken=JSON.stringify({route:{provider:'osrm'},destination:{lat:21.03,lng:105.78},savedAtMs:Date.now()});
      localStorage.setItem('kingmast:v25:route',broken);
      localStorage.setItem('kingmast:v006:route',broken);
      localStorage.setItem('kingmast:v25:recent-places',JSON.stringify([{id:null,name:7,position:{lat:'bad'}}]));
      localStorage.setItem('kingmast:v25:ev-profile',JSON.stringify({batteryPct:'invalid',rangeKm:null}));
    });
    await openDrive(page);
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('kingmast:v25:route'))).toBeNull();
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('kingmast:v006:route'))).toBeNull();
    expect(errors).toEqual([]);
  });
});
