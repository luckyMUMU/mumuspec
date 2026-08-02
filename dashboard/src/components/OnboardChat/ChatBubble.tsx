/**
 * Floating bubble / drawer toggle.
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import styles from './OnboardChat.module.css';

export const ChatBubble = memo(function ChatBubble() {
  const chatOpen = useDashboardStore((s) => s.chatOpen);
  const toggleChat = useDashboardStore((s) => s.toggleChat);

  if (!chatOpen) {
    return (
      <button
        className={styles.bubble}
        onClick={toggleChat}
        data-testid="chat-bubble"
        aria-label="打开引导"
      >
        💬
      </button>
    );
  }

  return (
    <div className={styles.drawer} data-testid="chat-drawer">
      <ChatMessages />
      <ChatInput />
    </div>
  );
});
