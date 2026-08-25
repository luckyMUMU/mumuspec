/**
 * Top toolbar — title + view placeholder + search box.
 */

import { QAView } from '@/components/QAView';
import styles from './Toolbar.module.css';

export function Toolbar() {
  return (
    <header className={styles.toolbar} data-testid="toolbar">
      <span className={styles.title}>MumuSpec Dashboard</span>
      <div className={styles.spacer} />
      <QAView />
    </header>
  );
}
