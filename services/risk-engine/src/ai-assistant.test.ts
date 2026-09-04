import { describe,expect,it } from 'vitest';
import { ASSISTANT_TOOL_ALLOWLIST,assertReadOnlyAssistantPlan,planAssistantRequest } from './ai-assistant.js';

describe('KINGMAST assistant router',()=>{
  it('routes Vietnamese road-context questions to read-only tools',()=>{
    const plan=planAssistantRequest('Phía trước có nguy hiểm gì không?');
    expect(plan.intent).toBe('road-context');
    expect(plan.tools).toContain('road.active-hazards');
    expect(plan.advisoryOnly).toBe(true);
  });
  it('keeps settings deep interaction parked-only',()=>{
    expect(planAssistantRequest('Mở cài đặt').requiresParked).toBe(true);
  });
  it('contains no actuator-style tool surface',()=>{
    expect(ASSISTANT_TOOL_ALLOWLIST.join(' ')).not.toMatch(/brake|steer|throttle|gear|torque|can\.write/i);
    expect(assertReadOnlyAssistantPlan(planAssistantRequest('Tại sao cảnh báo?'))).toBe(true);
  });
});
