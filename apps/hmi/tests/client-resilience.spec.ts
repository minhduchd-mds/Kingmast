import { expect,test } from '@playwright/test';

test('keeps the driver HMI alive when WebGL is unavailable',async({page})=>{
  await page.addInitScript(()=>{
    window.localStorage.setItem('kingmast:v006:first-run-complete','1');
    const original=HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{
      configurable:true,
      value:function(this:HTMLCanvasElement,type:string,...args:unknown[]){
        if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;
        return Reflect.apply(original,this,[type,...args]);
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('map-renderer-fallback').first()).toBeVisible({timeout:10_000});
  await expect(page.getByText('Map renderer unavailable').first()).toBeVisible();
  await expect(page.getByText('Driver display unavailable')).toHaveCount(0);
  await expect(page.getByText('Demo mode').first()).toBeVisible();
});
