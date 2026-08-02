import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardFlow } from '@/hooks/useOnboardFlow';

describe('useOnboardFlow', () => {
  it('TC-L2-002: initial step = 0, progress = 0', () => {
    const { result } = renderHook(() => useOnboardFlow('new-member'));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('TC-L2-002: advance writes localStorage with role prefix', () => {
    const { result } = renderHook(() => useOnboardFlow('new-member'));
    act(() => result.current.advance(1));
    expect(result.current.stepIndex).toBe(1);
    expect(localStorage.getItem('mumuspec-dashboard:onboard:role:new-member')).toBe('1');
  });

  it('TC-L2-002: different roles do not share progress', () => {
    const a = renderHook(() => useOnboardFlow('new-member'));
    act(() => a.result.current.advance(2));
    expect(localStorage.getItem('mumuspec-dashboard:onboard:role:new-member')).toBe('2');

    const b = renderHook(() => useOnboardFlow('lead'));
    expect(b.result.current.stepIndex).toBe(0);
    expect(localStorage.getItem('mumuspec-dashboard:onboard:role:lead')).toBeNull();
  });

  it('TC-L2-003: answer jumps to role-specific step', () => {
    const { result } = renderHook(() => useOnboardFlow('lead'));
    act(() =>
      result.current.answer('welcome', {
        label: 'Tech Lead',
        next: 'lead-step-1',
      }),
    );
    expect(result.current.currentStep.id).toBe('lead-step-1');
    expect(result.current.role).toBe('lead');
  });
});
