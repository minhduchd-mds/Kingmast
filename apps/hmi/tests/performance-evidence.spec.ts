import { writeFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';
import hmiPackage from '../package.json';

const enabled=process.env.KINGMAST_HMI_PERFORMANCE_EVIDENCE==='1';
const outputPath=process.env.KINGMAST_HMI_PERFORMANCE_OUTPUT??'performance-evidence.json';

function percentile(values:number[],ratio:number){
  if(values.length===0)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*ratio)-1))];
}
function round(value:number,digits=2){const scale=10**digits;return Math.round(value*scale)/scale;}

test.describe('KINGMAST HMI performance evidence',()=>{
  test.skip(!enabled,'performance evidence runs only in the dedicated CI evidence step');

  test('records boot, frame-time and WebGL fallback evidence without target-hardware claims',async({page,browserName})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.addInitScript(()=>localStorage.setItem('kingmast:v006:first-run-complete','1'));

    const startedAt=performance.now();
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.getByTestId('kingmast-startup')).toBeVisible({timeout:4_000});
    const startupVisibleMs=performance.now()-startedAt;
    await expect(page.locator('main.appShell')).toBeVisible({timeout:4_000});
    const bootToReadyMs=performance.now()-startedAt;
    await expect(page.locator('.speedValue')).toBeVisible();
    await expect(page.getByTestId('driver-action-dock')).toBeVisible();
    await expect(page.getByTestId('surround-spatial-layer')).toBeVisible({timeout:5_000});
    const markerCount=await page.getByTestId('surround-spatial-layer').locator('.surroundMarker').count();
    const firstUsableDrivingSurfaceMs=performance.now()-startedAt;

    const frameDeltas=await page.evaluate(async()=>new Promise<number[]>((resolve)=>{
      const samples:number[]=[];
      const durationMs=1_500;
      let previous=performance.now();
      const endAt=previous+durationMs;
      function frame(now:number){
        samples.push(now-previous);
        previous=now;
        if(now>=endAt)resolve(samples);else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }));
    const meaningfulFrameDeltas=frameDeltas.slice(1);
    const jankThresholdMs=34;
    const jankFrames=meaningfulFrameDeltas.filter((value)=>value>jankThresholdMs).length;
    const jankRatio=meaningfulFrameDeltas.length===0?1:jankFrames/meaningfulFrameDeltas.length;

    await page.getByRole('button',{name:'Navigate'}).click();
    await expect(page.getByRole('heading',{name:'Navigate'})).toBeVisible();
    const mapCanvas=page.locator('canvas.maplibregl-canvas').first();
    const mapFallback=page.getByTestId('map-renderer-fallback');
    await expect.poll(async()=>Boolean(await mapCanvas.isVisible().catch(()=>false)||await mapFallback.isVisible().catch(()=>false)),{timeout:7_000}).toBe(true);
    let webglFallbackMode:'context-loss'|'renderer-unavailable'|'not-observed'='not-observed';
    if(await mapCanvas.isVisible().catch(()=>false)){
      await mapCanvas.dispatchEvent('webglcontextlost');
      await expect(mapFallback).toBeVisible({timeout:4_000});
      webglFallbackMode='context-loss';
    }else if(await mapFallback.isVisible().catch(()=>false)){
      webglFallbackMode='renderer-unavailable';
    }

    const target={frameMs:16.67,frameP50Ms:20,frameP95Ms:34,frameP99Ms:50} as const;
    const budget={bootToReadyMs:1_800,firstUsableDrivingSurfaceMs:2_000,frameP50Ms:target.frameP50Ms,frameP95Ms:target.frameP95Ms,frameP99Ms:target.frameP99Ms,frameMaxMs:120,jankRatioMax:.08,minSurroundMarkers:2} as const;
    const latency={
      startupVisibleMs:round(startupVisibleMs),
      bootToReadyMs:round(bootToReadyMs),
      firstUsableDrivingSurfaceMs:round(firstUsableDrivingSurfaceMs),
    };
    const frameTiming={
      sampleCount:meaningfulFrameDeltas.length,
      p50Ms:round(percentile(meaningfulFrameDeltas,.50)),
      p95Ms:round(percentile(meaningfulFrameDeltas,.95)),
      p99Ms:round(percentile(meaningfulFrameDeltas,.99)),
      maxMs:round(Math.max(0,...meaningfulFrameDeltas)),
      jankThresholdMs,
      jankFrames,
      jankRatio:round(jankRatio,4),
    };
    const checks={
      bootToReady:latency.bootToReadyMs<=budget.bootToReadyMs,
      firstUsableDrivingSurface:latency.firstUsableDrivingSurfaceMs<=budget.firstUsableDrivingSurfaceMs,
      frameP50:frameTiming.p50Ms<=budget.frameP50Ms,
      frameP95:frameTiming.p95Ms<=budget.frameP95Ms,
      frameP99:frameTiming.p99Ms<=budget.frameP99Ms,
      frameMax:frameTiming.maxMs<=budget.frameMaxMs,
      jankRatio:frameTiming.jankRatio<=budget.jankRatioMax,
      surroundLoad:markerCount>=budget.minSurroundMarkers,
      webglFallback:webglFallbackMode!=='not-observed',
    };
    const allPassed=Object.values(checks).every(Boolean);
    const report={
      schema:'kingmast-hmi-performance-report/v1',
      generatedAt:new Date().toISOString(),
      productVersion:hmiPackage.version,
      controlAuthority:'none' as const,
      qualificationClaim:'ci-browser-regression-only-not-target-display-or-vehicle-computer' as const,
      targetHardwareQualified:false,
      physicalVehicleComputerTest:false,
      userStudyEvidence:false,
      browser:browserName,
      viewport:{width:1366,height:768},
      workload:{simulator:true,surroundMarkers:markerCount,mapSurface:true,alertAndSpatialUi:'simulator-driven'},
      performanceTarget:{name:'60fps-oriented-browser-target',...target,targetHardwareValidated:false},
      latency,
      frameTiming,
      rendererFallback:{mode:webglFallbackMode,passed:checks.webglFallback},
      budget,
      checks,
      allPassed,
    };
    await writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8');

    expect(allPassed,JSON.stringify(report,null,2)).toBe(true);
  });
});
