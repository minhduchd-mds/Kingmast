import { describe,expect,it } from 'vitest';
import { ASSISTANT_TOOL_ALLOWLIST,assertReadOnlyAssistantPlan,planAssistantRequest } from './ai-assistant.js';

describe('KINGMAST assistant router',()=>{
  it('routes Vietnamese road-context questions to read-only tools',()=>{
    const plan=planAssistantRequest('Phía trước có nguy hiểm gì không?');
    expect(plan.intent).toBe('road-context');
    expect(plan.tools).toContain('road.active-hazards');
    expect(plan.advisoryOnly).toBe(true);
  });
  it('routes driver-assist status questions through read-only vehicle health',()=>{
    const plan=planAssistantRequest('DMS và camera 360 hiện thế nào?');
    expect(plan.intent).toBe('vehicle-status');
    expect(plan.tools).toEqual(['vehicle.health']);
    expect(plan.responseHint).toContain('driver-assistance runtime health');
    expect(plan.requiresParked).toBe(false);
  });
  it('routes lane-warning explanations to traceable read-only evidence',()=>{
    const plan=planAssistantRequest('Vì sao lệch làn?');
    expect(plan.intent).toBe('explain-alert');
    expect(plan.tools).toContain('alerts.explain');
    expect(plan.tools).toContain('vehicle.health');
  });
  it('keeps settings deep interaction parked-only',()=>{
    expect(planAssistantRequest('Mở cài đặt').requiresParked).toBe(true);
  });
  it('contains no actuator-style tool surface',()=>{
    expect(ASSISTANT_TOOL_ALLOWLIST.join(' ')).not.toMatch(/brake|steer|throttle|gear|torque|can\.write/i);
    expect(assertReadOnlyAssistantPlan(planAssistantRequest('Tại sao cảnh báo?'))).toBe(true);
  });
});
