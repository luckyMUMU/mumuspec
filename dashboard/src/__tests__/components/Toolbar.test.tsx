// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar } from '@/components/Toolbar';

describe('Toolbar', () => {
  it('TC-L1-008: renders title + search', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByText('MumuSpec Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('qa-search')).toBeInTheDocument();
  });
});
