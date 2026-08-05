/**
 * Tests for src/change/paths.ts — change directory path utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getChangesDir,
  getArchiveDir,
  getChangeDir,
} from '../../src/change/paths.js';

describe('change paths', () => {
  it('getChangesDir returns .mumuspec/changes', () => {
    const root = '/project';
    const result = getChangesDir(root);
    expect(result).toContain('.mumuspec');
    expect(result).toContain('changes');
  });

  it('getArchiveDir returns archive directory', () => {
    const root = '/project';
    const result = getArchiveDir(root);
    expect(result).toContain('archive');
  });

  it('getChangeDir constructs change-specific directory', () => {
    const root = '/project';
    const result = getChangeDir(root, 'feature-test');
    expect(result).toContain('feature-test');
    expect(result).toContain('changes');
  });
});
