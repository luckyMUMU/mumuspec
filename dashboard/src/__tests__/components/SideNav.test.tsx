// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SideNav } from '@/components/SideNav';

describe('SideNav', () => {
  it('TC-L1-008: renders 3 role buttons', () => {
    render(<SideNav />);
    expect(screen.getByTestId('sidenav')).toBeInTheDocument();
    expect(screen.getByTestId('role-new-member')).toBeInTheDocument();
    expect(screen.getByTestId('role-lead')).toBeInTheDocument();
    expect(screen.getByTestId('role-solo')).toBeInTheDocument();
  });
});
