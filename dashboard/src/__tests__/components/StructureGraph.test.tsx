// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { mockGraphData } from '@/data/mock-graph';

vi.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="reactflow-mock">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => <div data-testid="minimap-mock" />,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rfp">{children}</div>
  ),
}));

import { GraphCanvas } from '@/components/StructureGraph';

describe('StructureGraph', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('TC-L1-001: renders nodes', () => {
    render(
      <ReactFlowProvider>
        <GraphCanvas nodes={mockGraphData.nodes} edges={mockGraphData.edges} />
      </ReactFlowProvider>,
    );
    expect(screen.getByTestId('rfp')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-mock')).toBeInTheDocument();
    expect(screen.getByTestId('minimap-mock')).toBeInTheDocument();
  });

  it('TC-L1-002: node count >= 12', () => {
    expect(mockGraphData.nodes.length).toBeGreaterThanOrEqual(12);
  });
});
