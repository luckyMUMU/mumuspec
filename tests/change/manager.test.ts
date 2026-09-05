/**
 * Tests for src/change/manager.ts — createChange, listActiveChanges, loadChangeState.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createChange,
  loadChangeState,
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
  validateScope,
  discardChange,
} from '../../src/change/manager.js';
import { getDefaultConfig } from '../../src/core/config.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { ChangeState } from '../../src/core/types.js';

function testConfig(): MumuSpecConfig {
  return getDefaultConfig('test-change-mgr');
}

function createProject(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-chg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  return { dir, config: testConfig() };
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('createChange', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('creates a change with valid name and workflow', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'feature-auth', 'full', config);

    // Assert
    expect(state).toBeDefined();
    expect(state.name).toBe('feature-auth');
    expect(state.workflow).toBe('full');
    expect(state.phase).toBe('open');
    expect(state.scope).toBe('.');
    expect(state.created_at).toBeTruthy();
    expect(state.updated_at).toBeTruthy();
  });

  it('persists change state to disk', () => {
    // Arrange & Act
    createChange(projectDir, 'feature-api', 'full', config);

    // Assert
    const statePath = join(projectDir, '.mumuspec', 'changes', 'feature-api', '.mumuspec.yaml');
    expect(existsSync(statePath)).toBe(true);
    const content = readFileSync(statePath, 'utf8');
    expect(content).toContain('name: feature-api');
  });

  it('creates required subdirectories', () => {
    // Arrange & Act
    createChange(projectDir, 'feature-db', 'full', config);

    // Assert
    const changeDir = join(projectDir, '.mumuspec', 'changes', 'feature-db');
    expect(existsSync(join(changeDir, 'delta-specs'))).toBe(true);
    expect(existsSync(join(changeDir, 'constraints'))).toBe(true);
    expect(existsSync(join(changeDir, 'test-cases'))).toBe(true);
    expect(existsSync(join(changeDir, 'code-graph'))).toBe(true);
    expect(existsSync(join(changeDir, 'snapshots'))).toBe(true);
  });

  it('throws E-CHANGE-001 on active change conflict', () => {
    // Arrange
    createChange(projectDir, 'feature-first', 'full', config);

    // Act & Assert
    expect(() => {
      createChange(projectDir, 'feature-second', 'full', config);
    }).toThrow(/E-CHANGE-001/);
  });

  it('allows second change after discard', () => {
    // Arrange
    createChange(projectDir, 'feature-temp', 'full', config);
    discardChange(projectDir, 'feature-temp', 'testing conflict');

    // Act
    const second = createChange(projectDir, 'feature-next', 'full', config);

    // Assert
    expect(second.name).toBe('feature-next');
  });

  it('sets build_layers for hotfix workflow', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'hotfix-bug', 'hotfix', config, ['src/api']);

    // Assert
    expect(state.build_layers.length).toBe(1);
    expect(state.build_layers[0].scope).toBe('src/api');
    expect(state.build_layers[0].status).toBe('pending');
  });

  it('sets build_layers for tweak workflow', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'tweak-ui', 'tweak', config, ['src/components']);

    // Assert
    expect(state.build_layers.length).toBe(1);
  });

  it('starts loop workflow at build phase', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'loop-task', 'loop', config, ['src/auto']);

    // Assert
    expect(state.phase).toBe('build');
  });

  it('allows parallel changes when single_active_change is false', () => {
    // Arrange
    const parallelConfig = { ...config };
    parallelConfig.workflow = { ...config.workflow, single_active_change: false };
    createChange(projectDir, 'feature-1', 'full', parallelConfig);

    // Act
    const second = createChange(projectDir, 'feature-2', 'full', parallelConfig);

    // Assert
    expect(second.name).toBe('feature-2');
  });

  it('validates scope against affected_scopes', () => {
    // Arrange & Act & Assert
    expect(() => {
      createChange(projectDir, 'out-of-scope', 'full', config, ['../../etc'], 'src/api');
    }).toThrow(/E-CHANGE-008/);
  });
});

describe('getChange (loadChangeState)', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns undefined for non-existent change', () => {
    // Arrange & Act
    const state = loadChangeState(projectDir, 'no-such-change');

    // Assert
    expect(state).toBeUndefined();
  });

  it('reads existing change state', () => {
    // Arrange
    createChange(projectDir, 'feature-read', 'full', config);

    // Act
    const state = loadChangeState(projectDir, 'feature-read');

    // Assert
    expect(state).toBeDefined();
    expect(state!.name).toBe('feature-read');
    expect(state!.workflow).toBe('full');
    expect(state!.phase).toBe('open');
  });

  it('reflects updated state after modification', () => {
    // Arrange
    createChange(projectDir, 'feature-update', 'full', config);

    // Act - manually modify state file
    const statePath = join(projectDir, '.mumuspec', 'changes', 'feature-update', '.mumuspec.yaml');
    const content = readFileSync(statePath, 'utf8');
    const updatedContent = content.replace('phase: open', 'phase: design');
    writeFileSync(statePath, updatedContent);

    // Assert
    const state = loadChangeState(projectDir, 'feature-update');
    expect(state!.phase).toBe('design');
  });
});

describe('listActiveChanges (listChanges)', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty for no changes', () => {
    // Arrange & Act
    const result = listActiveChanges(projectDir);

    // Assert
    expect(result).toEqual([]);
  });

  it('includes newly created active changes', () => {
    // Arrange
    createChange(projectDir, 'feature-a', 'full', config);

    // Act
    const result = listActiveChanges(projectDir);

    // Assert
    expect(result).toContain('feature-a');
  });

  it('filters out discarded changes', () => {
    // Arrange
    createChange(projectDir, 'feature-discard', 'full', config);
    discardChange(projectDir, 'feature-discard', 'no longer needed');

    // Act
    const result = listActiveChanges(projectDir);

    // Assert
    expect(result).not.toContain('feature-discard');
  });

  it('lists multiple active changes when allowed', () => {
    // Arrange
    const parallelConfig = { ...config };
    parallelConfig.workflow = { ...config.workflow, single_active_change: false };
    createChange(projectDir, 'feature-x', 'full', parallelConfig);
    createChange(projectDir, 'feature-y', 'full', parallelConfig);

    // Act
    const result = listActiveChanges(projectDir);

    // Assert
    expect(result).toContain('feature-x');
    expect(result).toContain('feature-y');
  });
});

describe('listArchivedChanges', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty when no archived changes exist', () => {
    // Arrange & Act
    const result = listArchivedChanges(projectDir);

    // Assert
    expect(result).toEqual([]);
  });

  it('lists entries in archive directory', () => {
    // Arrange - manually create an archive entry
    const archiveDir = join(projectDir, '.mumuspec', 'changes', 'archive');
    mkdirSync(archiveDir, { recursive: true });
    const archivedChangeDir = join(archiveDir, '2026-01-15-old-feature');
    mkdirSync(archivedChangeDir, { recursive: true });
    writeFileSync(join(archivedChangeDir, '.mumuspec.yaml'), 'name: old-feature\nphase: archive-completed\n');

    // Act
    const result = listArchivedChanges(projectDir);

    // Assert
    expect(result).toContain('2026-01-15-old-feature');
  });
});

describe('getActiveChange', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns undefined when no active change', () => {
    // Arrange & Act
    const result = getActiveChange(projectDir);

    // Assert
    expect(result).toBeUndefined();
  });

  it('returns the active change name', () => {
    // Arrange
    createChange(projectDir, 'feature-active', 'full', config);

    // Act
    const result = getActiveChange(projectDir);

    // Assert
    expect(result).toBe('feature-active');
  });

  it('excludes discarded changes', () => {
    // Arrange
    createChange(projectDir, 'feature-gone', 'full', config);
    discardChange(projectDir, 'feature-gone', 'done');

    // Act
    const result = getActiveChange(projectDir);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('validateScope', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createProject().dir;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('accepts affected scopes within parent scope', () => {
    // Arrange & Act
    const result = validateScope(projectDir, 'src/api', ['src/api/auth', 'src/api/users']);

    // Assert
    expect(result.valid).toBe(true);
    expect(result.overflowPaths).toEqual([]);
  });

  it('rejects affected scopes outside parent scope', () => {
    // Arrange & Act
    const result = validateScope(projectDir, 'src/api', ['src/api/auth', 'src/db/schema']);

    // Assert
    expect(result.valid).toBe(false);
    expect(result.overflowPaths).toContain('src/db/schema');
  });

  it('accepts root scope with any paths', () => {
    // Arrange & Act
    const result = validateScope(projectDir, '.', ['src/api', 'docs/readme']);

    // Assert
    expect(result.valid).toBe(true);
  });

  it('accepts exact match of scope', () => {
    // Arrange & Act
    const result = validateScope(projectDir, 'src/api', ['src/api']);

    // Assert
    expect(result.valid).toBe(true);
  });

  it('ignores dot path in affected scopes', () => {
    // Arrange & Act
    const result = validateScope(projectDir, 'src/api', ['.', 'src/api/auth']);

    // Assert
    expect(result.valid).toBe(true);
    expect(result.overflowPaths).toEqual([]);
  });
});

describe('edge cases', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('handles change name with hyphens and underscores', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'my_feature-v2_final', 'full', config);

    // Assert
    expect(state.name).toBe('my_feature-v2_final');
  });

  it('preserves affected_scopes in state', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'scoped-change', 'full', config, ['src/api', 'src/db']);

    // Assert
    expect(state.affected_scopes).toEqual(['src/api', 'src/db']);
  });

  it('creates decisions_log with empty counts', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'decisions-test', 'full', config);

    // Assert
    expect(state.decisions_log.counts).toEqual({});
  });

  it('sets rollback and rebuild limits from config', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'limits-test', 'full', config);

    // Assert
    expect(state.rollback_limit).toBe(config.changes.default_rollback_limit);
    expect(state.rebuild_limit).toBe(config.changes.default_rebuild_limit);
  });

  it('cognitive framework is disabled for non-full workflow', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'hotfix-cog', 'hotfix', config, ['src/bug']);

    // Assert
    expect(state.cognitive_framework.enabled).toBe(false);
  });

  it('cognitive framework is enabled for full workflow', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'full-cog', 'full', config);

    // Assert
    expect(state.cognitive_framework.enabled).toBe(true);
  });

  it('handles very long change name', () => {
    // Arrange
    const longName = 'a'.repeat(200);

    // Act
    const state = createChange(projectDir, longName, 'full', config);

    // Assert
    expect(state.name).toBe(longName);
  });

  it('sets tdd_mode correctly (CHG-5: default non-tdd for LLM autonomy)', () => {
    // Arrange & Act
    const state = createChange(projectDir, 'tdd-test', 'full', config);

    // Assert — CHG-5 (0.20): default_tdd_mode changed to 'non-tdd'
    expect(state.tdd_mode).toBe('non-tdd');
  });
});
