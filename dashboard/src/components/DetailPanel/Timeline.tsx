/**
 * Change event timeline — for kind=Change nodes.
 */

import { memo } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './DetailPanel.module.css';

export const Timeline = memo(function Timeline() {
  const timeline = useDashboardStore((s) => s.detailTimeline);

  if (timeline.length === 0) return null;

  return (
    <div className={styles.timeline} data-testid="detail-timeline">
      <div className={styles.timelineTitle}>Change 时间线</div>
      {timeline.map((ev) => (
        <div className={styles.event} key={ev.id} data-testid={`event-${ev.id}`}>
          <span>{ev.type}</span>
          <span style={{ color: 'var(--text-muted)' }}>{ev.timestamp.slice(0, 10)}</span>
        </div>
      ))}
    </div>
  );
});
