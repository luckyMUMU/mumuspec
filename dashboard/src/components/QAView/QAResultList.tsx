/**
 * QA results list — click result → store.focusNode 联动。
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './QAView.module.css';

export const QAResultList = memo(function QAResultList() {
  const qaResults = useDashboardStore((s) => s.qaResults);
  const focusNode = useDashboardStore((s) => s.focusNode);

  if (qaResults.length === 0) {
    return (
      <div className={styles.empty} data-testid="qa-empty">
        输入关键词开始搜索
      </div>
    );
  }

  return (
    <div className={styles.results} data-testid="qa-results">
      {qaResults.map((r) => (
        <div
          key={r.item.id}
          className={styles.result}
          data-testid={`qa-result-${r.item.id}`}
          onClick={() => r.item.relatedNodeId && focusNode(r.item.relatedNodeId)}
        >
          <div className={styles.resultTitle}>{r.item.title}</div>
          <div className={styles.resultScore}>score: {r.score}</div>
        </div>
      ))}
    </div>
  );
});
