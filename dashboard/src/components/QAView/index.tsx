/**
 * QAView public composition.
 */

import { SearchBox } from './SearchBox';
import { QAResultList } from './QAResultList';
import './QAView.module.css';

export function QAView() {
  return (
    <div data-testid="qa-view">
      <SearchBox />
      <QAResultList />
    </div>
  );
}
