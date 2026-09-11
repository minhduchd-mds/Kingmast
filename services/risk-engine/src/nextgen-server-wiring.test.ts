import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe,expect,it} from 'vitest';

const serverPath=fileURLToPath(new URL('./server.ts',import.meta.url));
const source=readFileSync(serverPath,'utf8');

describe('nextgen server wiring contract',()=>{
  it('registers nextgen API behind viewer and dedicated configuration authority',()=>{
    expect(source).toContain("await app.register(nextgenApiRoutes");
    expect(source).toContain("requireViewer:(request,reply)=>requireViewerAuth(request,reply)");
    expect(source).toContain("'configuration:nextgen'");
  });

  it('feeds existing camera and DMS ingress into the advisory runtime',()=>{
    expect(source).toContain('ingestLegacyFrontCamera(nextgenRuntime');
    expect(source).toContain('ingestLegacyDms(nextgenRuntime');
  });

  it('keeps nextgen control authority explicitly disabled',()=>{
    expect(source).toContain("nextgenControlAuthority:'none'");
    expect(source).not.toMatch(/nextgenControlAuthority:\s*'(steer|brake|throttle|vehicle)'/);
  });
});
