/**
 * Message list rendering — user / assistant / system-progress.
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import type { ChatMessage } from '@/types/chat';
import styles from './OnboardChat.module.css';

interface ChatMessagesProps {
  onOptionClick?: (option: { label: string; next?: string; focusNodeId?: string }) => void;
}

export const ChatMessages = memo(function ChatMessages({ onOptionClick }: ChatMessagesProps) {
  const messages = useDashboardStore((s) => s.chatMessages);

  return (
    <div className={styles.messages} data-testid="chat-messages">
      {messages.length === 0 && (
        <div className={`${styles.msg} ${styles['system-progress']}`}>暂无消息</div>
      )}
      {messages.map((m: ChatMessage) => (
        <div key={m.id} data-testid={`msg-${m.sender}`} className={`${styles.msg} ${styles[m.sender]}`}>
          {m.text}
          {m.options && m.options.length > 0 && (
            <div className={styles.options}>
              {m.options.map((opt) => (
                <button
                  key={opt.label}
                  className={styles.optionBtn}
                  onClick={() => onOptionClick?.(opt)}
                  data-testid={`opt-${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
