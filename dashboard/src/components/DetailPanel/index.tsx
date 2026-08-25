/**
 * DetailPanel — 编排 MetadataView + Timeline.
 */

import { MetadataView } from './MetadataView';
import { Timeline } from './Timeline';
import styles from './DetailPanel.module.css';

export function DetailPanel() {
  return (
    <aside className={styles.panel} data-testid="detail-panel">
      <MetadataView />
      <Timeline />
    </aside>
  );
}
