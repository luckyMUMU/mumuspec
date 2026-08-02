// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QAView } from '@/components/QAView';
import { useDashboardStore } from '@/store/useDashboardStore';

describe('QAView', () => {
  it('TC-L1-005: search keyword hit shows results and click focuses node', () => {
    const focusSpy = vi.spyOn(useDashboardStore.getState(), 'focusNode');
    render(<QAView />);
    const input = screen.getByTestId('qa-input');
    fireEvent.change(input, { target: { value: 'ponytail' } });
    fireEvent.click(screen.getByTestId('qa-submit'));
    expect(screen.getByTestId('qa-results')).toBeInTheDocument();
    const firstResult = screen.getAllByTestId(/qa-result-/)[0];
    expect(firstResult).toBeInTheDocument();
    fireEvent.click(firstResult);
    expect(focusSpy).toHaveBeenCalled();
  });

  it('TC-L1-006: no match shows empty', () => {
    render(<QAView />);
    const input = screen.getByTestId('qa-input');
    fireEvent.change(input, { target: { value: 'xyznotexist' } });
    fireEvent.click(screen.getByTestId('qa-submit'));
    expect(screen.getByTestId('qa-empty')).toBeInTheDocument();
  });
});
