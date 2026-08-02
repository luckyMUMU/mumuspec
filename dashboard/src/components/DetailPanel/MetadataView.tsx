/**
 * Display node metadata key-value pairs.
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './DetailPanel.module.css';

export const MetadataView = memo(function MetadataView() {
  const node = useDashboardStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  );

  if (!node) {
    return (
      <div className={styles.empty} data-testid="detail-empty">
        请选择节点查看详情
      </div>
    );
  }

  return (
    <div data-testid="metadata-view">
      <div className={styles.title} data-testid="detail-title">
        {node.label}
      </div>
      {Object.entries(node.metadata).map(([k, v]) => (
        <div className={styles.metaItem} key={k}>
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <p style={{ fontSize: 12, lineHeight: 1.5 }} data-testid="detail-summary">
        {node.summary}
      </p>
    </div>
  );
});
