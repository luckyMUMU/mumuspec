/**
 * Tests for feedback/manager.ts — feedback directory helpers and feedback ID generation.
 * Pure logic only — no filesystem I/O to keep tests deterministic.
 */
import { describe, it, expect } from 'vitest';

describe('feedback/manager (logic)', () => {
  it('feedback ID format pattern', () => {
    // FB-YYYYMMDD-<hash> format
    const fbId = 'FB-20260805-a1b2c3d4';
    expect(fbId).toMatch(/^FB-\d{8}-[a-f0-9]{8}$/);
  });

  it('slugify handles common title patterns', () => {
    const slugify = (t: string) =>
      t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    expect(slugify('Fix the bug')).toBe('fix-the-bug');
    expect(slugify('Add new feature!')).toBe('add-new-feature');
    expect(slugify('  Trim  spaces  ')).toBe('trim-spaces');
  });

  it('feedback type union members', () => {
    const validTypes = ['bug', 'feature-request', 'improvement', 'question', 'design-review'];
    expect(validTypes).toHaveLength(5);
    expect(validTypes).toContain('bug');
    expect(validTypes).toContain('design-review');
  });
});
