/**
 * App shell — 编排 Toolbar / SideNav / StructureGraph / DetailPanel / OnboardChat.
 */

import { useEffect } from 'react';
import { Toolbar } from '@/components/Toolbar';
import { SideNav } from '@/components/SideNav';
import { GraphCanvas } from '@/components/StructureGraph';
import { DetailPanel } from '@/components/DetailPanel';
import { ChatBubble } from '@/components/OnboardChat';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useMockData } from '@/hooks/useMockData';
import { mockOnboardSteps } from '@/data/mock-onboard-steps';
import { generateId } from '@/utils/id';
import type { ChatMessage } from '@/types/chat';
import styles from './App.module.css';

export function App() {
  const { nodes, edges } = useMockData();
  const appendMessage = useDashboardStore((s) => s.appendMessage);
  const setOnNodeFocus = useDashboardStore((s) => s.setOnNodeFocus);
  const focusNode = useDashboardStore((s) => s.focusNode);

  // 初始化欢迎消息
  useEffect(() => {
    const welcome = mockOnboardSteps[0];
    const msg: ChatMessage = {
      id: generateId('msg'),
      sender: 'system-progress',
      text: welcome.prompt,
      options: welcome.options,
      timestamp: new Date().toISOString(),
    };
    appendMessage(msg);

    setOnNodeFocus((id: string) => focusNode(id));
  }, [appendMessage, setOnNodeFocus, focusNode]);

  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.main}>
        <SideNav />
        <div className={styles.content}>
          <GraphCanvas nodes={nodes} edges={edges} />
          <DetailPanel />
        </div>
      </div>
      <ChatBubble />
    </div>
  );
}
