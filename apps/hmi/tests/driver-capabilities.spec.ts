import { expect,test,type Page } from '@playwright/test';

async function openReturningDriver(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));
  await page.goto('/');
  await expect(page.locator('main.appShell')).toBeVisible({timeout:7_000});
}

function dispatchRuntime(page:Page,dmsState:'attentive'|'distracted'='attentive'){
  return page.evaluate((state)=>{
    const now=Date.now();
    const assist={
      generatedAtMs:now,
      controlAuthority:'none' as const,
      ldw:{availability:'live' as const,observedAtMs:now,ageMs:20,severity:'caution' as const,side:'right' as const,timeToLineCrossingS:1.2,confidence:.93,reason:'lane-departure-right',advisoryOnly:true as const},
      dms:{availability:'live' as const,observedAtMs:now,ageMs:15,state,confidence:.91,perclos:.08,gazeAwayRatio:state==='attentive'?0.12:0.72,faceAvailability:.98,reason:state==='attentive'?'attention-within-thresholds':'gaze-away',storesRawVideo:false as const,advisoryOnly:true as const},
      assistant:{availability:'live' as const,observedAtMs:now,ageMs:0,reason:'read-only-context-ready',readOnly:true as const,actuatorTools:false as const},
      surround:{availability:'live' as const,observedAtMs:now,ageMs:30,cameraCount:4,calibratedCameraCount:4,synchronizedCameraCount:4,maxReprojectionErrorPx:1.7,reason:'surround-calibration-ready',visualizationOnly:true as const},
    };
    const frame={
      sequence:42,
      vehicle:{lat:21.0285,lng:105.8542,speedKmh:48,headingDeg:0,accuracyM:2,timestampMs:now,source:'gnss' as const},
      sensors:{radarFront:'ok' as const,radarRear:'ok' as const,camera:'ok' as const,can:'ok' as const,gnssImu:'ok' as const,ecu:'ok' as const},
      objects:[],
      alerts:[],
      assist,
    };
    window.dispatchEvent(new CustomEvent('kingmast:telemetry',{detail:{frame,receivedAtMs:now,diagnostics:null}}));
  },dmsState);
}

test.describe('driver-facing assistance capability rail',()=>{
  test('shows truthful staged status without creating control authority',async({page})=>{
    await openReturningDriver(page,1366,768);
    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute('data-runtime','awaiting');
    await expect(rail).toHaveAttribute('data-quiet','false');
    await expect(rail).toContainText('Warning-only · no vehicle control');
    await expect(rail.locator('[data-capability="ldw"]')).toContainText('Software ready');
    await expect(rail.locator('[data-capability="dms"]')).toContainText('DMS');
    await expect(rail.locator('[data-capability="assistant"]')).toContainText('Read-only assistant');
    await expect(rail.locator('[data-capability="surround"]')).toContainText('Requires vehicle integration');
    await expect(rail.getByRole('button')).toHaveCount(0);
  });

  test('collapses normal secondary status while moving and keeps attention-relevant assist state',async({page})=>{
    await openReturningDriver(page,1366,768);
    await dispatchRuntime(page,'attentive');
    const rail=page.getByTestId('driver-capability-rail');
    await expect(rail).toHaveAttribute('data-runtime','connected');
    await expect(rail).toHaveAttribute('data-quiet','true');
    await expect(rail).toContainText('Quiet monitoring');
    await expect(rail.locator('[data-capability="ldw"]')).toContainText('Departure risk · right');
    await expect(rail.locator('[data-capability="ldw"]')).toContainText('TTLC 1.2 s');
    await expect(rail.locator('[data-capability="dms"]')).toHaveCount(0);
    await expect(rail.locator('[data-capability="assistant"]')).toHaveCount(0);
    await expect(rail.locator('[data-capability="surround"]')).toHaveCount(0);

    await dispatchRuntime(page,'distracted');
    await expect(rail.locator('[data-capability="dms"]')).toContainText('Attention away');
    await expect(rail.locator('.driverCapabilityItem')).toHaveCount(2);
    await expect(rail.getByRole('button')).toHaveCount(0);
  });

  test('drops the secondary capability rail on short automotive displays',async({page})=>{
    await openReturningDriver(page,1280,480);
    await expect(page.getByTestId('driver-capability-rail')).toBeHidden();
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.locator('.speedLimitSign')).toBeVisible();
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();
  });
});
