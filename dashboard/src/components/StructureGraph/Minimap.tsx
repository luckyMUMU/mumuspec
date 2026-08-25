/**
 * Minimap — React Flow MiniMap via portal wrapper.
 * ponytail: 用 reactflow MiniMap (已包含)，仅做样式定位。
 */

import { memo } from 'react';
import { MiniMap } from 'reactflow';
import styles from './StructureGraph.module.css';

export const Minimap = memo(function Minimap() {
  return (
    <div className={styles.minimap} data-testid="minimap">
      <MiniMap
        nodeColor={(n) => {
          const kind = (n.data?.kind as string) ?? '';
          return kind === 'Change'
            ? '#10b981'
            : kind === 'Knowledge'
              ? '#a855f7'
              : kind === 'Constraint'
                ? '#f59e0b'
                : '#4f8cff';
        }}
        maskColor="rgba(20,22,35,0.6)"
        style={{ background: '#1f2233' }}
      />
    </div>
  );
});
