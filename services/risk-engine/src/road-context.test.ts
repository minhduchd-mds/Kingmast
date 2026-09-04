import { describe,expect,it } from 'vitest';
import { classifySpeedCompliance,parseMaxspeed } from './road-context.js';

describe('road context speed rules',()=>{
  it('parses common map speed formats',()=>{expect(parseMaxspeed('50')).toBe(50);expect(parseMaxspeed('80 km/h')).toBe(80);expect(parseMaxspeed('30 mph')).toBe(48);expect(parseMaxspeed('VN:urban')).toBeNull();});
  it('adds a small display tolerance before overspeed',()=>{expect(classifySpeedCompliance(50,46)).toBe('within-limit');expect(classifySpeedCompliance(50,49)).toBe('near-limit');expect(classifySpeedCompliance(50,53)).toBe('near-limit');expect(classifySpeedCompliance(50,54)).toBe('over-limit');expect(classifySpeedCompliance(null,80)).toBe('unknown');});
});
