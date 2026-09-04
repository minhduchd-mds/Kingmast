import { expect,test,type BrowserContext,type Page } from '@playwright/test';

async function openReturningHmi(page:Page){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

async function setOffline(context:BrowserContext,value:boolean){await context.setOffline(value);}

test.describe('KINGMAST route recovery UX',()=>{
  test('offline navigation disables new destination search without hiding the driving HMI',async({page,context})=>{
    await openReturningHmi(page);
    await page.getByRole('button',{name:'Navigate'}).click();
    await setOffline(context,true);
    const recovery=page.getByTestId('route-recovery');
    await expect(recovery).toBeVisible();
    await expect(recovery).toContainText('Offline navigation');
    await expect(recovery).toContainText('Primary on-vehicle warnings remain active');
    const search=page.getByLabel('Search destination');
    await expect(search).toBeDisabled();
    await expect(search).toHaveAttribute('placeholder','Destination search unavailable offline');
    await expect(page.locator('main.appShell')).toBeVisible();
    await setOffline(context,false);
  });

  test('ending an active cached route requires an explicit reversible confirmation',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      localStorage.setItem('kingmast:v006:first-run-complete','1');
      const origin={lat:21.0285,lng:105.8542};const destination={lat:21.0325,lng:105.8622};const route={provider:'osrm',origin,destination,distanceM:1200,durationS:300,geometry:[origin,{lat:21.0305,lng:105.8582},destination],steps:[{instruction:'Continue straight',distanceM:650,durationS:150,location:{lat:21.0305,lng:105.8582},roadName:'Demo Avenue'},{instruction:'Arrive at destination',distanceM:550,durationS:150,location:destination,roadName:'Demo Avenue'}],fetchedAtMs:Date.now()};
      localStorage.setItem('kingmast:v25:route',JSON.stringify({route,destination,savedAtMs:Date.now()}));
    });
    await page.goto('/');
    await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
    await page.getByRole('button',{name:'Navigate'}).click();
    await expect(page.getByText('Cached route',{exact:true})).toBeVisible();
    const endRoute=page.getByRole('button',{name:'End route'});
    await endRoute.click();
    const confirm=page.getByRole('group',{name:'Confirm ending route guidance'});
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('End route guidance?');
    await confirm.getByRole('button',{name:'Keep guidance'}).click();
    await expect(confirm).toBeHidden();
    await endRoute.click();
    await page.getByRole('button',{name:'End guidance'}).click();
    await expect(page.getByText('Ready to navigate',{exact:true})).toBeVisible();
  });
});
