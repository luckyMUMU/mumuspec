/**
 * User message input — submits to store.
 */

import { memo, useState, useCallback } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { generateId } from '@/utils/id';
import styles from './OnboardChat.module.css';

export const ChatInput = memo(function ChatInput() {
  const [value, setValue] = useState('');
  const appendMessage = useDashboardStore((s) => s.appendMessage);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) return; // ponytail: guard 拒绝空消息
    appendMessage({
      id: generateId('chat'),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    });
    setValue('');
  }, [value, appendMessage]);

  return (
    <form
      className={styles.inputRow}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="输入消息…"
        data-testid="chat-input"
      />
      <button type="submit" data-testid="chat-send">
        发送
      </button>
    </form>
  );
});
