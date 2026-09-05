import { expect, test, type Page } from '@playwright/test';

async function primeReturningUser(page:Page){
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
}

async function openHmi(page:Page,width:number,height:number,reducedMotion=true){
  await page.setViewportSize({width,height});
  if(reducedMotion)await page.emulateMedia({reducedMotion:'reduce'});
  await primeReturningUser(page);
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

async function openConnectivitySettings(page:Page){
  await page.getByTestId('driver-action-dock').getByRole('button',{name:'Open settings'}).click();
  await expect(page.getByTestId('hmi-settings')).toBeVisible();
  await page.getByRole('tab',{name:'Connectivity'}).click();
  await expect(page.getByTestId('wifi-settings')).toBeVisible();
}

async function hasHorizontalOverflow(page:Page){
  return page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
}

test.describe('KINGMAST v0.0.6 automotive HMI',()=>{
  test('startup experience is branded, calm and completes into Drive for a returning driver',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await primeReturningUser(page);
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
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('first-run setup is contextual, privacy-aware and preserves critical warnings',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');
    const setup=page.getByTestId('first-run-experience');
    await expect(setup).toBeVisible({timeout:4_000});
    await expect(setup).toContainText('Safety first. Minimal setup.');
    await expect(setup).toContainText('Critical collision and vulnerable-road-user warnings always stay active.');
    await setup.getByRole('button',{name:/Continue/}).click();
    await expect(setup).toContainText('Location');
    await expect(setup).toContainText('does not store coordinates');
    await setup.getByRole('button',{name:/Continue/}).last().click();
    await expect(setup).toContainText(/Host network available|Offline mode is ready/);
    await setup.getByRole('button',{name:'Continue'}).click();
    await expect(setup).toContainText('Your driving view is configured.');
    await expect(setup.getByRole('switch',{name:'Optional road advisories during first-run setup'})).toHaveAttribute('aria-checked','true');
    await setup.getByRole('button',{name:/Start KINGMAST/}).click();
    await expect(page.locator('main.appShell')).toBeVisible();
    const stored=await page.evaluate(()=>localStorage.getItem('kingmast:v006:first-run-complete'));
    expect(stored).toBe('1');
  });

  test('primary navigation and driver controls keep automotive touch targets',async({page})=>{
    await openHmi(page,1366,768);
    const controls=page.locator('.navItem,.voiceToggle,.maneuverBanner>button,.driverActionDock button');
    const count=await controls.count();
    expect(count).toBeGreaterThan(8);
    for(let index=0;index<count;index++){
      const control=controls.nth(index);
      if(!(await control.isVisible()))continue;
      const box=await control.boundingBox();
      expect(box?.height??0).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button',{name:'Navigate'}).click();
    await expect(page.getByRole('heading',{name:'Navigate'})).toBeVisible();
    await page.getByRole('button',{name:/Alerts/}).first().click();
    await expect(page.getByRole('heading',{name:'Alerts'})).toBeVisible();
  });

  test('quick action dock opens route and parked settings without cluttering Drive',async({page})=>{
    await openHmi(page,1366,768);
    const dock=page.getByTestId('driver-action-dock');
    await dock.getByRole('button',{name:/Route/}).click();
    await expect(page.getByRole('heading',{name:'Navigate'})).toBeVisible();
    await page.getByRole('button',{name:'Drive'}).click();
    await dock.getByRole('button',{name:'Open settings'}).click();
    await expect(page.getByTestId('hmi-settings')).toBeVisible();
    const laneSwitch=page.getByRole('switch',{name:/Lane guidance/});
    await expect(laneSwitch).toBeVisible();
    await laneSwitch.click();
    await page.getByRole('button',{name:'Done'}).click();
    await expect(page.locator('.v5Cockpit')).toBeVisible();
  });

  test('optional road advisories require confirmation and preserve critical safety messaging',async({page})=>{
    await openHmi(page,1366,768);
    await page.getByTestId('driver-action-dock').getByRole('button',{name:'Open settings'}).click();
    const advisorySwitch=page.getByRole('switch',{name:'Optional road advisories'});
    await expect(advisorySwitch).toHaveAttribute('aria-checked','true');
    await advisorySwitch.click();
    const confirm=page.getByRole('group',{name:'Confirm turning off optional road advisories'});
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Critical safety warnings remain active');
    await confirm.getByRole('button',{name:'Turn off advisories'}).click();
    await expect(advisorySwitch).toHaveAttribute('aria-checked','false');
    await expect(page.getByRole('switch',{name:'Camera alerts'})).toBeDisabled();
    await page.getByRole('button',{name:'Done'}).click();
    await expect(page.getByTestId('advisory-mode-off')).toBeVisible();
    await expect(page.locator('.connectedRoadHud')).toHaveCount(0);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmast:v006:hmi-preferences')??'{}'));
    expect(stored.advisoryAlerts).toBe(false);
  });

  test('offline mode is explicit and pauses connected-road UI without hiding core HMI',async({page,context})=>{
    await openHmi(page,1366,768);
    await context.setOffline(true);
    const offline=page.getByTestId('offline-mode');
    await expect(offline).toBeVisible();
    await expect(offline).toContainText('Primary on-vehicle warnings remain active');
    await expect(page.locator('main.appShell')).toBeVisible();
    await expect(page.locator('.connectedRoadHud')).toHaveCount(0);
    await context.setOffline(false);
    await expect(offline).toBeHidden();
  });

  test('web preview reports Wi-Fi as host-managed instead of faking radio control',async({page})=>{
    await openHmi(page,1366,768);
    await openConnectivitySettings(page);
    const wifi=page.getByTestId('wifi-settings');
    await expect(wifi).toContainText('Managed by host device');
    await expect(wifi).toContainText('web preview cannot switch the Wi-Fi radio');
  });

  test('native Wi-Fi bridge supports parked scan and secure connect flow',async({page})=>{
    await page.addInitScript(()=>{
      let enabled=true;let connectedSsid:string|null=null;
      (window as unknown as {kingmastNative:unknown}).kingmastNative={wifi:{
        getState:async()=>({enabled,connectedSsid,internetReachable:Boolean(connectedSsid)}),
        setEnabled:async(next:boolean)=>{enabled=next;if(!next)connectedSsid=null;return{enabled,connectedSsid,internetReachable:Boolean(connectedSsid)};},
        scan:async()=>[{ssid:'KINGMAST Lab',signal:4,secure:true,saved:false},{ssid:'Guest',signal:2,secure:false,saved:false}],
        connect:async(input:{ssid:string;password?:string})=>{if(input.ssid==='KINGMAST Lab'&&input.password!=='test-pass')throw new Error('bad password');connectedSsid=input.ssid;return{enabled,connectedSsid,internetReachable:true};},
        disconnect:async()=>{connectedSsid=null;return{enabled,connectedSsid,internetReachable:false};},
      }};
    });
    await openHmi(page,1366,768);
    await openConnectivitySettings(page);
    const wifi=page.getByTestId('wifi-settings');
    await expect(wifi.getByRole('switch',{name:'Wi-Fi'})).toHaveAttribute('aria-checked','true');
    await wifi.getByRole('button',{name:/Scan/}).click();
    await expect(wifi.getByText('KINGMAST Lab')).toBeVisible();
    await wifi.getByRole('button',{name:/KINGMAST Lab/}).click();
    await wifi.getByLabel('Network password').fill('test-pass');
    await wifi.getByRole('button',{name:'Connect'}).click();
    await expect(wifi).toContainText('Connected to KINGMAST Lab');
  });

  test('saved Wi-Fi network reconnects without asking for the password again',async({page})=>{
    await page.addInitScript(()=>{
      let enabled=true;let connectedSsid:string|null=null;
      (window as unknown as {kingmastNative:unknown}).kingmastNative={wifi:{
        getState:async()=>({enabled,connectedSsid,internetReachable:Boolean(connectedSsid)}),
        setEnabled:async(next:boolean)=>{enabled=next;return{enabled,connectedSsid,internetReachable:Boolean(connectedSsid)};},
        scan:async()=>[{ssid:'Fleet Secure',signal:4,secure:true,saved:true}],
        connect:async(input:{ssid:string})=>{connectedSsid=input.ssid;return{enabled,connectedSsid,internetReachable:true};},
        disconnect:async()=>{connectedSsid=null;return{enabled,connectedSsid,internetReachable:false};},
        forget:async()=>{connectedSsid=null;return{enabled,connectedSsid,internetReachable:false};},
      }};
    });
    await openHmi(page,1366,768);
    await openConnectivitySettings(page);
    const wifi=page.getByTestId('wifi-settings');
    await wifi.getByRole('button',{name:/Scan/}).click();
    await expect(wifi).toContainText('Known network');
    await wifi.getByRole('button',{name:/Fleet Secure/}).click();
    await expect(wifi).toContainText('Connected to Fleet Secure');
    await expect(wifi.getByLabel('Network password')).toHaveCount(0);
  });

  test('voice action gives immediate non-blocking feedback',async({page})=>{
    await openHmi(page,1366,768);
    const dock=page.getByTestId('driver-action-dock');
    const voice=dock.getByRole('button',{name:/Turn voice guidance off/});
    await expect(voice).toBeVisible();
    await voice.click();
    const toast=page.getByTestId('interaction-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Voice guidance off');
    await expect(dock.getByRole('button',{name:/Turn voice guidance on/})).toBeVisible();
  });

  test('active caution opens a non-destructive modal sheet and returns focus on Escape',async({page})=>{
    await openHmi(page,1366,768);
    const dock=page.getByTestId('driver-action-dock');
    const alertButton=dock.getByRole('button',{name:/Alerts/});
    // The first lateral-only simulator event is intentionally not a textual alert.
    // Wait for the subsequent genuine forward caution before exercising the hazard sheet.
    await expect(alertButton).toHaveClass(/hasAlert/,{timeout:9_000});
    await alertButton.click();
    const sheet=page.getByTestId('driver-action-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal','true');
    const keepRoute=sheet.getByRole('button',{name:/Keep current route/});
    await expect(keepRoute).toBeVisible();
    await expect(keepRoute).toBeFocused();
    await expect(sheet.getByRole('button',{name:/Mute voice/})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(alertButton).toBeFocused();
  });

  test('modal sheet traps keyboard focus inside driver actions',async({page})=>{
    await openHmi(page,1366,768);
    const alertButton=page.getByTestId('driver-action-dock').getByRole('button',{name:/Alerts/});
    await expect(alertButton).toHaveClass(/hasAlert/,{timeout:9_000});
    await alertButton.click();
    const sheet=page.getByTestId('driver-action-sheet');
    await expect(sheet).toBeVisible();
    for(let index=0;index<8;index++)await page.keyboard.press('Tab');
    const focusInside=await page.evaluate(()=>Boolean(document.activeElement?.closest('[data-testid="driver-action-sheet"]')));
    expect(focusInside).toBe(true);
    await page.keyboard.press('Escape');
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
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('1280x480 compacts secondary content instead of shrinking safety information',async({page})=>{
    await openHmi(page,1280,480);
    await expect(page.locator('.v5Cockpit')).toBeVisible();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.driverAlert')).toBeVisible();
    await expect(page.locator('.v5DriveSide')).toBeHidden();
    await expect(page.locator('.connectedRoadHud')).toBeHidden();
    const alertHeight=await page.locator('.driverAlert').evaluate((node)=>parseFloat(getComputedStyle(node).minHeight));
    expect(alertHeight).toBeGreaterThanOrEqual(56);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('reduced motion removes event animation without removing interaction feedback',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.emulateMedia({reducedMotion:'reduce'});
    await primeReturningUser(page);
    const started=Date.now();
    await page.goto('/');
    await expect(page.locator('main.appShell')).toBeVisible({timeout:2_000});
    expect(Date.now()-started).toBeLessThan(2_000);
    const voice=page.getByTestId('driver-action-dock').getByRole('button',{name:/Turn voice guidance off/});
    await voice.click();
    const toast=page.getByTestId('interaction-toast');
    await expect(toast).toBeVisible();
    const animationName=await toast.evaluate((node)=>getComputedStyle(node).animationName);
    expect(animationName).toBe('none');
  });
});
