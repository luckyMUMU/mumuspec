/**
 * Floating detail panel inside the canvas (top-left).
 * Reads selectedNode from store.
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './StructureGraph.module.css';

export const NodeDetail = memo(function NodeDetail() {
  const node = useDashboardStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  );

  if (!node) return null;

  return (
    <div className={styles.nodeDetail} data-testid="node-detail">
      <div>
        <strong data-testid="node-detail-label">{node.label}</strong>
      </div>
      <div style={{ color: '#999', fontSize: 10, marginTop: 2 }}>
        {node.kind}
      </div>
      <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>{node.summary}</p>
    </div>
  );
});
