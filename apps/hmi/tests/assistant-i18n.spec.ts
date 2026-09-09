import { expect,test,type Page } from '@playwright/test';

const PROFILE_KEY='kingmast:v006:driver-profile';
const FIRST_RUN_KEY='kingmast:v006:first-run-complete';

async function boot(page:Page,locale:'en-US'|'vi-VN'='vi-VN'){
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({profileKey,firstRunKey,locale})=>{
    localStorage.setItem(firstRunKey,'1');
    localStorage.setItem(profileKey,JSON.stringify({id:'primary',name:'Primary Driver',locale,units:'metric',textScale:'standard',contrast:'system',motion:'reduced',updatedAtMs:Date.now()}));
  },{profileKey:PROFILE_KEY,firstRunKey:FIRST_RUN_KEY,locale});
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:8_000});
}

test.describe('KINGMAST Vietnamese localization and Assistant V1',()=>{
  test('vi-VN changes primary driver and settings surfaces',async({page})=>{
    await boot(page,'vi-VN');
    await expect(page.locator('html')).toHaveAttribute('lang','vi');
    await expect(page.getByRole('button',{name:'Mở Trợ lý KINGMAST'})).toBeVisible();
    const dock=page.getByTestId('driver-action-dock');
    await expect(dock).toContainText('Giọng nói');
    await expect(dock).toContainText('Cảnh báo');
    await dock.getByRole('button',{name:'Mở cài đặt'}).click();
    const settings=page.getByTestId('hmi-settings');
    await expect(settings).toContainText('Cài đặt KINGMAST');
    await expect(settings.getByRole('tab',{name:'Xe & cập nhật'})).toBeVisible();
    await expect(settings.getByRole('tab',{name:'Quyền riêng tư'})).toBeVisible();
    await expect(settings.getByRole('tab',{name:'Hồ sơ'})).toBeVisible();
    await settings.getByRole('tab',{name:'Xe & cập nhật'}).click();
    await expect(page.getByTestId('device-health')).toContainText('Phần cứng & trạng thái thiết bị');
    await expect(page.getByTestId('sensor-maintenance')).toContainText('Hiệu chuẩn & thay thế cảm biến');
    await expect(page.getByTestId('software-update')).toContainText('Cập nhật phần mềm & firmware');
  });

  test('offline assistant explains native device faults without fabricating live context',async({page})=>{
    await page.addInitScript(()=>{
      (window as any).kingmastNative={devices:{
        getState:async()=>({profileId:'bench-a',profiles:[],updatedAtMs:Date.now(),devices:[
          {id:'front-radar',label:'Front radar',category:'sensor',connection:'connected',health:'fault',interfaceLabel:'CAN-FD / channel 1',firmwareVersion:'rd-2.3',lastSeenAtMs:Date.now(),detail:'Receive timeout.',faults:[{code:'CAN_RX_TIMEOUT',layer:'link',severity:'critical',summary:'CAN receive timeout',action:'Kiểm tra nguồn radar và dây CAN.'}]},
          {id:'gnss-imu',label:'GNSS / IMU',category:'sensor',connection:'connected',health:'ready',interfaceLabel:'sensor fusion',firmwareVersion:'nav-3.1',lastSeenAtMs:Date.now(),detail:null,faults:[]},
        ]}),
        diagnose:async()=>({profileId:'bench-a',profiles:[],updatedAtMs:Date.now(),devices:[]}),
      }};
    });
    await page.route('**/api/kingmast/assistant',route=>route.abort());
    await boot(page,'vi-VN');
    await page.getByRole('button',{name:'Mở Trợ lý KINGMAST'}).click();
    const assistant=page.getByTestId('kingmast-assistant');
    await assistant.getByRole('button',{name:'Thiết bị nào đang lỗi?'}).click();
    await expect(assistant).toContainText('Front radar');
    await expect(assistant).toContainText('CAN receive timeout');
    await expect(assistant).toContainText('Dự phòng ngoại tuyến');
    const persisted=await page.evaluate(()=>Object.keys(localStorage).filter((key)=>key.toLowerCase().includes('assistant')||key.toLowerCase().includes('transcript')));
    expect(persisted).toEqual([]);
  });

  test('moving mode disables text entry but keeps short voice path available',async({page})=>{
    await boot(page,'vi-VN');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('kingmast:telemetry',{detail:{frame:{vehicle:{source:'gnss',speedKmh:48}}}})));
    await page.getByRole('button',{name:'Mở Trợ lý KINGMAST'}).click();
    const assistant=page.getByTestId('kingmast-assistant');
    const input=assistant.getByRole('textbox');
    await expect(input).toBeDisabled();
    await expect(input).toHaveAttribute('placeholder','Chỉ nhập chữ khi xe đang đỗ.');
    await expect(assistant.getByRole('button',{name:'Nhập bằng giọng nói'})).toBeEnabled();
    await expect(assistant).toContainText('Khi xe đang chạy, hãy dùng câu lệnh giọng nói ngắn.');
  });

  test('native Vietnamese voice input can ask the grounded assistant',async({page})=>{
    await page.addInitScript(()=>{
      (window as any).__spoken=[];
      (window as any).kingmastNative={voice:{listen:async()=>({text:'Thiết bị nào đang lỗi?'}),speak:async({text}:{text:string})=>{(window as any).__spoken.push(text);}}};
    });
    await page.route('**/api/kingmast/assistant',async(route)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'Không có thiết bị nào đang báo lỗi trong ngữ cảnh hiện tại.',mode:'grounded-fallback',grounded:true,executionAllowed:true,providerConfigured:false,controlAuthority:'none'})}));
    await boot(page,'vi-VN');
    await page.getByRole('button',{name:'Mở Trợ lý KINGMAST'}).click();
    const assistant=page.getByTestId('kingmast-assistant');
    await assistant.getByRole('button',{name:'Nhập bằng giọng nói'}).click();
    await expect(assistant).toContainText('Không có thiết bị nào đang báo lỗi trong ngữ cảnh hiện tại.');
    await expect.poll(()=>page.evaluate(()=>(window as any).__spoken.length)).toBeGreaterThan(0);
  });

  test('server assistant route remains read-only and degrades without a provider',async({request})=>{
    const response=await request.post('/api/kingmast/assistant',{data:{input:'Thiết bị nào đang lỗi?',locale:'vi-VN',devices:[{id:'front-radar',label:'Front radar',connection:'connected',health:'fault',faults:[{code:'CAN_RX_TIMEOUT',layer:'link',severity:'critical',summary:'CAN receive timeout',action:'Kiểm tra dây CAN'}]}]}});
    expect(response.ok()).toBeTruthy();
    const body=await response.json();
    expect(body.controlAuthority).toBe('none');
    expect(['provider','grounded-fallback','offline-fallback']).toContain(body.mode);
    expect(body.answer).toContain('Front radar');
  });
});
