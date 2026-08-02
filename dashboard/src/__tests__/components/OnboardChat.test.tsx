// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatBubble } from '@/components/OnboardChat';
import { useDashboardStore } from '@/store/useDashboardStore';

describe('OnboardChat', () => {
  it('TC-L1-003: renders collapsed bubble initially', () => {
    useDashboardStore.setState({ chatOpen: false });
    render(<ChatBubble />);
    expect(screen.getByTestId('chat-bubble')).toBeInTheDocument();
  });

  it('TC-L1-003: click bubble opens drawer', () => {
    useDashboardStore.setState({ chatOpen: false, chatMessages: [] });
    render(<ChatBubble />);
    fireEvent.click(screen.getByTestId('chat-bubble'));
    expect(screen.getByTestId('chat-drawer')).toBeInTheDocument();
  });

  it('TC-L1-004: empty message does not change state', () => {
    useDashboardStore.setState({ chatOpen: true, chatMessages: [] });
    render(<ChatBubble />);
    const send = screen.getByTestId('chat-send');
    fireEvent.click(send);
    expect(useDashboardStore.getState().chatMessages.length).toBe(0);
  });
});
