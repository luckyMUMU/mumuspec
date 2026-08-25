/**
 * Search input + submit.
 */

import { memo, useState, useCallback } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './QAView.module.css';

export const SearchBox = memo(function SearchBox() {
  const [value, setValue] = useState('');
  const submitQA = useDashboardStore((s) => s.submitQA);

  const submit = useCallback(() => {
    submitQA(value);
  }, [value, submitQA]);

  return (
    <form
      className={styles.searchRow}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="qa-search"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索知识库…"
        data-testid="qa-input"
      />
      <button type="submit" data-testid="qa-submit">
        搜索
      </button>
    </form>
  );
});
