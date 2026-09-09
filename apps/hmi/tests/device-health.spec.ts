import { expect, test, type Page } from '@playwright/test';

async function openVehicleSettings(page:Page){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:5_000});
  await page.getByTestId('driver-action-dock').getByRole('button',{name:'Open settings'}).click();
  await page.getByRole('tab',{name:'Vehicle & updates'}).click();
  await expect(page.getByTestId('device-health')).toBeVisible();
}

test.describe('KINGMAST physical device status UX',()=>{
  test('browser preview never fabricates connected hardware',async({page})=>{
    await openVehicleSettings(page);
    const panel=page.getByTestId('device-health');
    await expect(panel).toContainText('Waiting for vehicle host');
    await expect(panel).toContainText('Browser preview cannot claim that hardware is connected or healthy');
    await expect(panel.getByTestId('device-row-front-radar')).toContainText('Status unavailable');
    await expect(panel.getByTestId('device-row-read-only-can-interface')).toContainText('Status unavailable');
  });

  test('native host exposes connected, disconnected and exact fault point states',async({page})=>{
    await page.addInitScript(()=>{
      const profiles=[
        {id:'bench-a',label:'Bench A',description:'Development bench',qualificationStatus:'pending-physical-evidence'},
        {id:'bench-b',label:'Bench B',description:'Alternate bench',qualificationStatus:'development'},
      ];
      let devices=[
        {id:'front-radar',label:'Front radar',category:'sensor',connection:'connected',health:'fault',interfaceLabel:'CAN-FD / channel 1',firmwareVersion:'1.2.0',lastSeenAtMs:Date.now(),detail:'Frames are present but freshness is outside the accepted envelope.',faults:[{code:'CAN_RX_TIMEOUT',layer:'link',severity:'critical',summary:'Front radar data timeout',action:'Inspect radar power and CAN harness.'}]},
        {id:'surround-camera-set',label:'Surround camera set',category:'camera',connection:'disconnected',health:'unavailable',interfaceLabel:'GMSL2',firmwareVersion:null,lastSeenAtMs:null,detail:'No camera aggregator link detected.',faults:[]},
        {id:'gnss-imu',label:'GNSS / IMU',category:'sensor',connection:'connected',health:'ready',interfaceLabel:'UART / PPS',firmwareVersion:'0.9.4',lastSeenAtMs:Date.now(),detail:null,faults:[]},
      ];
      const snapshot=()=>({profileId:'bench-a',profiles,devices,updatedAtMs:Date.now()});
      (window as any).kingmastNative={devices:{
        getState:async()=>snapshot(),
        diagnose:async(deviceId:string)=>{if(deviceId==='front-radar')devices=devices.map((device:any)=>device.id===deviceId?{...device,health:'ready',detail:'Diagnostics passed after link recovery.',faults:[]}:device);return snapshot();},
        setProfile:async(profileId:string)=>({...snapshot(),profileId}),
      }};
    });
    await openVehicleSettings(page);
    const panel=page.getByTestId('device-health');
    const radar=panel.getByTestId('device-row-front-radar');
    const cameras=panel.getByTestId('device-row-surround-camera-set');
    await expect(panel).toContainText('1 fault');
    await expect(radar).toContainText('Connected');
    await expect(radar).toContainText('Fault');
    await expect(radar).toContainText('Front radar data timeout');
    await expect(radar).toContainText('Fault point: link · CAN_RX_TIMEOUT');
    await expect(radar).toContainText('Inspect radar power and CAN harness.');
    await expect(cameras).toContainText('Not connected');
    await expect(cameras).toContainText('No camera aggregator link detected.');
    await radar.getByRole('button',{name:'Run diagnostics'}).click();
    await expect(radar).toContainText('Ready');
    await expect(radar).toContainText('Diagnostics passed after link recovery.');
    await expect(radar).not.toContainText('CAN_RX_TIMEOUT');
  });

  test('hardware profile changes only through the native host bridge',async({page})=>{
    await page.addInitScript(()=>{
      const profiles=[
        {id:'baseline-a',label:'Baseline A',description:'Primary target',qualificationStatus:'pending-physical-evidence'},
        {id:'baseline-b',label:'Baseline B',description:'Service target',qualificationStatus:'development'},
      ];
      let profileId='baseline-a';
      const snapshot=()=>({profileId,profiles,devices:[{id:'vehicle-computer-aarch64',label:'Vehicle computer',category:'computer',connection:'connected',health:'ready',interfaceLabel:'AArch64',firmwareVersion:'0.0.6',lastSeenAtMs:Date.now(),detail:null,faults:[]}],updatedAtMs:Date.now()});
      (window as any).kingmastNative={devices:{getState:async()=>snapshot(),setProfile:async(next:string)=>{profileId=next;return snapshot();}}};
    });
    await openVehicleSettings(page);
    const panel=page.getByTestId('device-health');
    const select=panel.getByLabel('Hardware profile');
    await expect(select).toHaveValue('baseline-a');
    await select.selectOption('baseline-b');
    await panel.getByRole('button',{name:'Apply'}).click();
    await expect(select).toHaveValue('baseline-b');
    await expect(panel).toContainText('1 connected');
  });
});
