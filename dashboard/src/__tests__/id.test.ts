import { describe, it, expect } from 'vitest';
import { generateId } from '@/utils/id';

describe('utils/id', () => {
  it('TC-L3-003: generates unique ids for 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('node')));
    expect(ids.size).toBe(100);
  });

  it('TC-L3-003: id starts with prefix', () => {
    const id = generateId('node');
    expect(id.startsWith('node-')).toBe(true);
  });
});
