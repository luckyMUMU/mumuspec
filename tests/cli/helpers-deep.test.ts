/**
 * Deep tests for src/cli/helpers.ts.
 *
 * helpers-extra.test.ts already covers executeChat and createAgentInstallSubcommand.
 * This file adds deeper branch coverage for:
 * - getCssSummary: combinations of hasUiLibrary with empty string, multiple features
 * - getDirectorySummary: various unknown directory fallbacks
 * - collect: various edge cases (duplicate values, empty strings)
 * - executeChat: the answer path with all properties in detail
 * - createAgentInstallSubcommand: --target workspace with --workspace-path
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

// ── Hoisted mocks ──

const {
  mockAnswerQuery,
  mockGetManifest,
  mockSearchPackages,
  mockResolvePackage,
  mockInstallPackage,
  mockListInstalledAgentSkills,
  mockFormatAgentInstalledSkills,
} = vi.hoisted(() => ({
  mockAnswerQuery: vi.fn(),
  mockGetManifest: vi.fn(),
  mockSearchPackages: vi.fn(),
  mockResolvePackage: vi.fn(),
  mockInstallPackage: vi.fn(),
  mockListInstalledAgentSkills: vi.fn(),
  mockFormatAgentInstalledSkills: vi.fn(),
}));

vi.mock('../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

vi.mock('../../src/install/installer.js', () => ({
  getManifest: mockGetManifest,
  searchPackages: mockSearchPackages,
  resolvePackage: mockResolvePackage,
  installPackage: mockInstallPackage,
  listInstalledAgentSkills: mockListInstalledAgentSkills,
  formatAgentInstalledSkills: mockFormatAgentInstalledSkills,
}));

// Import after mocks
const {
  getCssSummary,
  getDirectorySummary,
  collect,
  executeChat,
  createAgentInstallSubcommand,
} = await import('../../src/cli/helpers.js');

// ════════════════════════════════════════════════════════════════════
// getCssSummary — deeper combinations
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > getCssSummary deep', () => {
  it('returns "none detected" when all flags false and uiLibrary empty string', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: false,
      uiLibrary: '',
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('none detected');
  });

  it('returns only "Tailwind" when only hasTailwind true', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind');
  });

  it('returns "SCSS" when only hasScss true', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: true,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('SCSS');
  });

  it('returns "CSS Modules" when only hasCssModules true', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: true,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('CSS Modules');
  });

  it('returns empty string when hasUiLibrary true but uiLibrary empty/falsy', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: true,
      uiLibrary: '',
    } as ProjectAnalysis;
    // When uiLibrary is falsy, it won't be pushed, so result is "none detected"
    expect(getCssSummary(analysis)).toBe('none detected');
  });

  it('returns combined "Tailwind + SCSS"', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: true,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind + SCSS');
  });

  it('returns combined "SCSS + CSS Modules + Vuetify"', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: true,
      hasCssModules: true,
      hasUiLibrary: true,
      uiLibrary: 'Vuetify',
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('SCSS + CSS Modules + Vuetify');
  });

  it('returns all four when everything is true', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: true,
      hasCssModules: true,
      hasUiLibrary: true,
      uiLibrary: 'Naive UI',
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind + SCSS + CSS Modules + Naive UI');
  });
});

// ════════════════════════════════════════════════════════════════════
// getDirectorySummary — unknown dir fallbacks
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > getDirectorySummary deep', () => {
  it('falls back to "<dir> module (<type>)" for unknown "tests" dir', () => {
    expect(getDirectorySummary('tests', 'cli')).toBe('tests module (cli)');
  });

  it('falls back for unknown "build" dir', () => {
    expect(getDirectorySummary('build', 'backend')).toBe('build module (backend)');
  });

  it('falls back for unknown "config" dir', () => {
    expect(getDirectorySummary('config', 'fullstack')).toBe('config module (fullstack)');
  });

  it('falls back for empty string dir', () => {
    expect(getDirectorySummary('', 'unknown')).toBe(' module (unknown)');
  });

  it('returns "Primary source code" for "src" (case sensitive)', () => {
    expect(getDirectorySummary('src', 'frontend')).toBe('Primary source code');
  });

  it('falls back for "SRC" (uppercase)', () => {
    expect(getDirectorySummary('SRC', 'frontend')).toBe('SRC module (frontend)');
  });
});

// ════════════════════════════════════════════════════════════════════
// collect — edge cases
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > collect deep', () => {
  it('accumulates duplicate values', () => {
    let acc: string[] = [];
    acc = collect('val', acc);
    acc = collect('val', acc);
    expect(acc).toEqual(['val', 'val']);
  });

  it('handles empty string value', () => {
    const result = collect('', ['a']);
    expect(result).toEqual(['a', '']);
  });

  it('handles special characters', () => {
    const result = collect('path/with/slashes', ['--include']);
    expect(result).toEqual(['--include', 'path/with/slashes']);
  });

  it('does not mutate previous array', () => {
    const prev = ['x', 'y'];
    const result = collect('z', prev);
    expect(prev).toEqual(['x', 'y']); // unchanged
    expect(result).toEqual(['x', 'y', 'z']);
  });
});

// ════════════════════════════════════════════════════════════════════
// executeChat — detailed response shapes
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > executeChat deep', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('JSON mode outputs all fields including empty array references', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'full-test',
      confidence: 0.75,
      answer: 'Detailed answer with **markdown**',
      references: [],
    });

    executeChat('/root', {} as never, 'full-test', true);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('"confidence": 0.75');
    expect(output).toContain('"answer"');
    expect(output).toContain('"references": []');
  });

  it('JSON mode handles references with multiple entries', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'multi-ref',
      confidence: 0.88,
      answer: 'Multi answer',
      references: [
        { id: 'doc-1', title: 'Design Doc', type: 'doc', relevance: 0.99 },
        { id: 'doc-2', title: 'Spec Doc', type: 'spec', relevance: 0.85 },
        { id: 'doc-3', title: 'Guide', type: 'knowledge', relevance: 0.6 },
      ],
    });

    executeChat('/root', {} as never, 'multi-ref', true);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // Should have all 3 references serialized
    expect(output).toContain('doc-1');
    expect(output).toContain('doc-2');
    expect(output).toContain('doc-3');
  });

  it('panel mode handles answer with single reference', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'one-ref',
      confidence: 0.95,
      answer: 'Single answer',
      references: [{ id: 'single-ref', title: 'Only Ref', type: 'doc', relevance: 0.9 }],
    });

    executeChat('/root', {} as never, 'one-ref', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('References:');
    expect(output).toContain('[single-ref] Only Ref');
    // Relevance 0.9 -> "90%"
    expect(output).toContain('90%');
  });

  it('panel mode with confidence=1 shows "Confidence: 1"', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'certain',
      confidence: 1,
      answer: 'Certain answer',
      references: [],
    });

    executeChat('/root', {} as never, 'certain', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Confidence: 1');
  });

  it('panel mode with confidence=0 shows "Confidence: 0"', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'uncertain',
      confidence: 0,
      answer: 'No confidence here',
      references: [],
    });

    executeChat('/root', {} as never, 'uncertain', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Confidence: 0');
  });
});

// ════════════════════════════════════════════════════════════════════
// createAgentInstallSubcommand — --target workspace
// ════════════════════════════════════════════════════════════════════

describe('createAgentInstallSubcommand — --target workspace', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createInstallCmd(): Command {
    const program = new Command();
    const installCmd = program.command('install');
    createAgentInstallSubcommand(installCmd, 'claude', 'claude-type', 'Install Claude skills');
    return program;
  }

  it('installs with --target workspace and --workspace-path', async () => {
    mockResolvePackage.mockReturnValue({ name: 'pkg-a', description: '', category: 'core' });
    mockInstallPackage.mockReturnValue({ success: true, path: '/workspace/.meituan-catpaw/skills/pkg-a' });

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'pkg-a', '--target', 'workspace', '--workspace-path', '/my/workspace']);

    expect(mockInstallPackage).toHaveBeenCalledWith(
      'claude-type', 'pkg-a', 'workspace', '/my/workspace', 'install',
    );

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('workspace');
  });

  it('installs multiple packages with mixed results', async () => {
    mockResolvePackage.mockReturnValue({ name: 'pkg', description: '', category: 'core' });
    mockInstallPackage
      .mockReturnValueOnce({ success: true, path: '/skills/pkg' })
      .mockReturnValueOnce({ success: false, error: 'Network error' });

    const program = createInstallCmd();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'pkg-a', 'pkg-b']),
    ).rejects.toThrow('process.exit called with code 1');

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('1 succeeded');
    expect(output).toContain('1 failed');
  });

  it('handles installPackage returning success with no path', async () => {
    mockResolvePackage.mockReturnValue({ name: 'pkg-no-path', description: '', category: 'core' });
    mockInstallPackage.mockReturnValue({ success: true, path: undefined });

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'pkg-no-path']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Installed');
    expect(output).toContain('pkg-no-path');
  });

  it('--list with single category groups them together', async () => {
    mockGetManifest.mockReturnValue([
      { name: 'pkg-a', description: 'Desc A', category: 'core' },
      { name: 'pkg-b', description: 'Desc B', category: 'core' },
    ]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--list']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[core]');
    expect(output).toContain('pkg-a');
    expect(output).toContain('pkg-b');
  });

  it('--search shows count for multiple results', async () => {
    mockSearchPackages.mockReturnValue([
      { name: 'mumuspec-workflow', description: 'Main workflow', category: 'core' },
      { name: 'mumuspec-review', description: 'Review tool', category: 'quality' },
    ]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--search', 'mumuspec']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('2 package(s) matching');
  });

  it('--installed shows formatted list', async () => {
    mockListInstalledAgentSkills.mockReturnValue({
      success: true,
      skills: ['mumuspec-workflow', 'mumuspec-review'],
    });
    mockFormatAgentInstalledSkills.mockReturnValue(
      '  - mumuspec-workflow (v1.0.0)\n  - mumuspec-review (v2.0.0)',
    );

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--installed']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('mumuspec-workflow');
    expect(output).toContain('mumuspec-review');
  });
});
