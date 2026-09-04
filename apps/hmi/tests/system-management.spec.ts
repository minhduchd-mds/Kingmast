import { expect, test, type Page } from '@playwright/test';

async function openSettings(page:Page){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:5_000});
  await page.getByTestId('driver-action-dock').getByRole('button',{name:'Open settings'}).click();
  await expect(page.getByTestId('hmi-settings')).toBeVisible();
}

test.describe('KINGMAST v0.0.6 parked system management',()=>{
  test('vehicle service and update screens never fake native hardware capability in browser preview',async({page})=>{
    await openSettings(page);
    await page.getByRole('tab',{name:'Vehicle & updates'}).click();
    const sensor=page.getByTestId('sensor-maintenance');const updates=page.getByTestId('software-update');
    await expect(sensor).toContainText('Managed by the vehicle host');
    await expect(sensor).toContainText('does not claim sensor calibration success');
    await expect(updates).toContainText('Updates are controlled by the native vehicle host');
    await expect(updates.getByRole('button',{name:'Check for updates'})).toBeDisabled();
  });

  test('privacy controls are opt-in and destructive navigation clearing is confirmed',async({page})=>{
    await page.addInitScript(()=>{localStorage.setItem('kingmast:v25:route','cached-route');localStorage.setItem('kingmast:v25:recent-places','cached-recents');});
    await openSettings(page);
    await page.getByRole('tab',{name:'Privacy'}).click();
    const panel=page.getByTestId('privacy-data-controls');
    const upload=panel.getByRole('switch',{name:'Diagnostic upload'});await expect(upload).toHaveAttribute('aria-checked','false');await upload.click();await expect(upload).toHaveAttribute('aria-checked','true');
    await panel.getByRole('button',{name:'Clear navigation history'}).click();
    const confirm=panel.getByRole('group',{name:'Confirm clearing navigation history'});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Clear history'}).click();
    const stored=await page.evaluate(()=>({route:localStorage.getItem('kingmast:v25:route'),recents:localStorage.getItem('kingmast:v25:recent-places'),privacy:JSON.parse(localStorage.getItem('kingmast:v006:privacy')??'{}')}));
    expect(stored.route).toBeNull();expect(stored.recents).toBeNull();expect(stored.privacy.diagnosticUpload).toBe(true);
  });

  test('driver profile and accessibility preferences restore at root runtime',async({page})=>{
    await openSettings(page);
    await page.getByRole('tab',{name:'Profile'}).click();
    const panel=page.getByTestId('driver-profile-controls');
    await panel.getByLabel('Driver name').fill('Primary Driver');await panel.getByLabel('Driver name').blur();
    await panel.getByRole('button',{name:'Imperial'}).click();
    await panel.getByRole('switch',{name:'Large text'}).click();await panel.getByRole('switch',{name:'High contrast'}).click();await panel.getByRole('switch',{name:'Reduce motion'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-kingmast-units','imperial');await expect(page.locator('html')).toHaveAttribute('data-kingmast-text-scale','large');await expect(page.locator('html')).toHaveAttribute('data-kingmast-contrast','high');await expect(page.locator('html')).toHaveAttribute('data-kingmast-motion','reduced');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmast:v006:driver-profile')??'{}'));expect(stored.name).toBe('Primary Driver');expect(stored.units).toBe('imperial');
    await page.reload();await expect(page.locator('html')).toHaveAttribute('data-kingmast-motion','reduced');await expect(page.locator('main.appShell')).toBeVisible({timeout:5_000});
  });

  test('native service bridge can report calibration completion and a signed update state',async({page})=>{
    await page.addInitScript(()=>{
      let sensors=[{id:'radar-front',label:'Front radar',state:'calibration-required',lastCalibrationAtMs:null,replacementDetected:true,detail:'Replacement detected.'},{id:'radar-rear',label:'Rear radar',state:'ready',lastCalibrationAtMs:Date.now(),replacementDetected:false,detail:null},{id:'camera-front',label:'Forward camera',state:'ready',lastCalibrationAtMs:Date.now(),replacementDetected:false,detail:null},{id:'gnss-imu',label:'GNSS / IMU',state:'ready',lastCalibrationAtMs:Date.now(),replacementDetected:false,detail:null}];
      let update={currentVersion:'0.0.6',firmwareVersion:'fw-0.4.2',status:'available',progressPct:0,available:{version:'0.0.6-dev2',sizeMb:18,releaseNotes:'UI and recovery fixes',signed:true},rollbackAvailable:true,detail:null};
      (window as any).kingmastNative={maintenance:{getState:async()=>({sensors,updatedAtMs:Date.now()}),calibrate:async()=>{sensors=sensors.map((item:any)=>item.id==='radar-front'?{...item,state:'ready',lastCalibrationAtMs:Date.now(),detail:'Calibration complete.'}:item);return{sensors,updatedAtMs:Date.now()};},verifyReplacement:async()=>({sensors,updatedAtMs:Date.now()})},updates:{getState:async()=>update,check:async()=>update,download:async()=>{update={...update,status:'ready',progressPct:100};return update;},install:async()=>{update={...update,status:'reboot-required'};return update;},rollback:async()=>update}};
    });
    await openSettings(page);await page.getByRole('tab',{name:'Vehicle & updates'}).click();
    const sensor=page.getByTestId('sensor-maintenance');await expect(sensor).toContainText('Calibration required');await sensor.getByRole('button',{name:'Calibrate'}).click();await sensor.getByRole('group',{name:'Confirm sensor maintenance action'}).getByRole('button',{name:'Start calibration'}).click();await expect(sensor).toContainText('Calibration complete.');
    const updates=page.getByTestId('software-update');await expect(updates).toContainText('v0.0.6-dev2 available');await updates.getByRole('button',{name:'Download'}).click();await updates.getByRole('button',{name:'Install signed update'}).click();await updates.getByRole('group',{name:'Confirm software update action'}).getByRole('button',{name:'Install update'}).click();await expect(updates).toContainText('Restart required');
  });
});
