// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';

vi.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rf">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rfp">{children}</div>
  ),
}));

import { App } from '@/App';
import { useDashboardStore } from '@/store/useDashboardStore';

describe('E2E: onboard flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('TC-L0-001: app renders welcome chat', () => {
    useDashboardStore.setState({
      chatMessages: [],
      chatOpen: true,
      role: null,
      selectedNodeId: null,
    });

    render(
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
  });
});
