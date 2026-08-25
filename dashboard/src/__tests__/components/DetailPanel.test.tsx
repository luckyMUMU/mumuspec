// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '@/components/DetailPanel';
import { useDashboardStore } from '@/store/useDashboardStore';

describe('DetailPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('TC-L1-007: empty when no selected node', () => {
    useDashboardStore.setState({ selectedNodeId: null, detailTimeline: [] });
    render(<DetailPanel />);
    expect(screen.getByTestId('detail-empty')).toBeInTheDocument();
  });

  it('TC-L1-007: shows metadata + timeline for change node', () => {
    useDashboardStore.getState().focusNode('change-onboard');
    render(<DetailPanel />);
    expect(screen.getByTestId('detail-title')).toHaveTextContent('dashboard-onboard-chat');
    expect(screen.getByTestId('detail-summary')).toBeInTheDocument();
    expect(screen.getByTestId('detail-timeline')).toBeInTheDocument();
  });

  it('TC-L1-007: no timeline for knowledge node', () => {
    useDashboardStore.getState().focusNode('kp-ponytail-ref');
    render(<DetailPanel />);
    expect(screen.getByTestId('detail-title')).toHaveTextContent('Ponytail');
    expect(screen.queryByTestId('detail-timeline')).not.toBeInTheDocument();
  });
});
