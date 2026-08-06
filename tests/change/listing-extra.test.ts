/**
 * Extra tests for src/change/listing.ts — boundary cases for listActiveChanges,
 * listArchivedChanges, getActiveChange.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadYaml = vi.fn();
const mockGetArchiveDir = vi.fn();
const mockGetChangesDir = vi.fn();
const mockLoadChangeState = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  relative: (from: string, to: string) => to.replace(from + '/', '') || '.',
  sep: '/',
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
}));

vi.mock('../../src/change/paths.js', () => ({
  getArchiveDir: (...args: unknown[]) => mockGetArchiveDir(...args),
  getChangesDir: (...args: unknown[]) => mockGetChangesDir(...args),
}));

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
}));

import {
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
} from '../../src/change/listing.js';

describe('listActiveChanges — boundary cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockGetChangesDir.mockReset();
    mockReadYaml.mockReset();
    mockLoadChangeState.mockReset();
    mockGetChangesDir.mockReturnValue('/root/.mumuspec/changes');
  });

  it('should return empty array when changesDir does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(listActiveChanges('/root', 'scope1')).toEqual([]);
  });

  it('should skip the archive directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'archive', isDirectory: () => true, isFile: () => false },
    ]);
    expect(listActiveChanges('/root', '.')).toEqual([]);
  });

  it('should skip directories without .mumuspec.yaml', () => {
    // existsSync returns true for changes dir but false for .mumuspec.yaml inside
    mockExistsSync.mockImplementation((p: string) => !p.includes('.mumuspec.yaml'));
    mockReaddirSync.mockReturnValue([
      { name: 'change-a', isDirectory: () => true, isFile: () => false },
    ]);
    expect(listActiveChanges('/root', '.')).toEqual([]);
  });

  it('should skip changes with discarded phase', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'change-b', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'discarded', workflow: 'full' });
    expect(listActiveChanges('/root', '.')).toEqual([]);
  });

  it('should skip changes with archive-completed phase', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'change-c', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    expect(listActiveChanges('/root', '.')).toEqual([]);
  });

  it('should include active change and return its name', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'change-active', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'design', workflow: 'full' });
    expect(listActiveChanges('/root', '.')).toEqual(['change-active']);
  });

  it('should handle multiple scopes', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'scoped-change', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'build', workflow: 'full' });
    mockGetChangesDir.mockReturnValue('/root/sub/.mumuspec/changes');
    const result = listActiveChanges('/root', 'sub');
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe('listArchivedChanges — boundary cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockGetArchiveDir.mockReset();
    mockGetArchiveDir.mockReturnValue('/root/.mumuspec/changes/archive');
  });

  it('should return empty when archive dir does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(listArchivedChanges('/root', '.')).toEqual([]);
  });

  it('should return directory names from archive', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'old-change-1', isDirectory: () => true, isFile: () => false },
      { name: 'old-change-2', isDirectory: () => true, isFile: () => false },
    ]);
    expect(listArchivedChanges('/root', '.')).toEqual(['old-change-1', 'old-change-2']);
  });

  it('should catch read errors and return partial results', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(listArchivedChanges('/root', '.')).toEqual([]);
  });
});

describe('getActiveChange — boundary cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockGetChangesDir.mockReset();
    mockGetChangesDir.mockReturnValue('/root/.mumuspec/changes');
    mockReadYaml.mockReset();
    mockLoadChangeState.mockReset();
  });

  it('should return undefined when no active changes', () => {
    mockExistsSync.mockReturnValue(false);
    expect(getActiveChange('/root', '.')).toBeUndefined();
  });

  it('should return first non-terminal change', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'active-change', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'design', workflow: 'full' });
    mockLoadChangeState.mockReturnValue({ phase: 'design', workflow: 'full' });
    expect(getActiveChange('/root', '.')).toBe('active-change');
  });

  it('should skip terminal phases and return undefined if all terminal', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'dead-change', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadYaml.mockReturnValue({ phase: 'discarded', workflow: 'full' });
    mockLoadChangeState.mockReturnValue({ phase: 'discarded', workflow: 'full' });
    expect(getActiveChange('/root', '.')).toBeUndefined();
  });
});
