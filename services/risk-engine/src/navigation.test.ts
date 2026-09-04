import { describe,expect,it } from 'vitest';
import { parseNavigationPlaces } from './navigation.js';

describe('navigation place parsing',()=>{
  it('normalizes valid geocoder results',()=>{
    const places=parseNavigationPlaces([{place_id:7,lat:'21.0285',lon:'105.8542',name:'Hoan Kiem',display_name:'Hoan Kiem, Hanoi, Vietnam'}]);
    expect(places).toHaveLength(1);
    expect(places[0]?.name).toBe('Hoan Kiem');
    expect(places[0]?.position).toEqual({lat:21.0285,lng:105.8542});
  });
  it('drops invalid coordinates',()=>{
    expect(parseNavigationPlaces([{place_id:1,lat:'999',lon:'105'}])).toEqual([]);
  });
});
