/**
 * Tests for CLI helper functions — src/cli/helpers.ts and src/cli/ui-helpers.ts.
 *
 * Covers:
 * - getCssSummary / getDirectorySummary / collect (helpers.ts)
 * - step / success / warn / fail / tip / formatDuration / progress / clearProgress (ui-helpers.ts)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';
import {
  getCssSummary,
  getDirectorySummary,
  collect,
} from '../../src/cli/helpers.js';
import {
  resetSteps,
  step,
  success,
  warn,
  fail,
  tip,
  formatDuration,
  progress,
  clearProgress,
} from '../../src/cli/ui-helpers.js';

// ════════════════════════════════════════════════════════════════════
// helpers.ts
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > getCssSummary', () => {
  it('should return "none detected" when no CSS features', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('none detected');
  });

  it('should list Tailwind when present', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind');
  });

  it('should join multiple CSS features with " + "', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: true,
      hasCssModules: false,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind + SCSS');
  });

  it('should include UI library name when present', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: true,
      uiLibrary: 'Element Plus',
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Element Plus');
  });

  it('should combine all features', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: true,
      hasCssModules: true,
      hasUiLibrary: true,
      uiLibrary: 'Ant Design',
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind + SCSS + CSS Modules + Ant Design');
  });
});

describe('helpers.ts > getDirectorySummary', () => {
  it('should return "Primary source code" for src', () => {
    expect(getDirectorySummary('src', 'frontend')).toBe('Primary source code');
  });

  it('should return "Library exports and public API" for lib', () => {
    expect(getDirectorySummary('lib', 'library')).toBe('Library exports and public API');
  });

  it('should return "Application routes and pages" for app', () => {
    expect(getDirectorySummary('app', 'frontend')).toBe('Application routes and pages');
  });

  it('should return "Monorepo sub-packages" for packages', () => {
    expect(getDirectorySummary('packages', 'monorepo')).toBe('Monorepo sub-packages');
  });

  it('should return "Demo/example applications" for demo', () => {
    expect(getDirectorySummary('demo', 'cli')).toBe('Demo/example applications');
  });

  it('should return "Usage examples" for examples', () => {
    expect(getDirectorySummary('examples', 'cli')).toBe('Usage examples');
  });

  it('should return fallback for unknown directory', () => {
    expect(getDirectorySummary('unknown-dir', 'backend')).toBe('unknown-dir module (backend)');
  });
});

describe('helpers.ts > collect', () => {
  it('should append value to previous array', () => {
    const result = collect('two', ['one']);
    expect(result).toEqual(['one', 'two']);
  });

  it('should work with empty initial array', () => {
    const result = collect('first', []);
    expect(result).toEqual(['first']);
  });

  it('should accumulate multiple values', () => {
    let acc: string[] = [];
    acc = collect('a', acc);
    acc = collect('b', acc);
    acc = collect('c', acc);
    expect(acc).toEqual(['a', 'b', 'c']);
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > step', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetSteps();
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print numbered step starting at 1', () => {
    step('First step');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/^\s+\[1\].*First step/);
  });

  it('should increment step counter', () => {
    step('Step one');
    step('Step two');
    step('Step three');
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[1\].*Step one/);
    expect(logSpy.mock.calls[1][0]).toMatch(/\[2\].*Step two/);
    expect(logSpy.mock.calls[2][0]).toMatch(/\[3\].*Step three/);
  });

  it('should reset counter via resetSteps', () => {
    step('Before reset');
    resetSteps();
    step('After reset');
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[1][0]).toMatch(/\[1\].*After reset/);
  });
});

describe('ui-helpers.ts > success', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print success message with checkmark', () => {
    success('All done');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('All done');
    expect(call).toMatch(/^  .*/);
  });
});

describe('ui-helpers.ts > warn', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print warning message', () => {
    warn('Something might be wrong');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('Something might be wrong');
    expect(call).toMatch(/^  .*/);
  });
});

describe('ui-helpers.ts > fail', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print failure message only when no recovery', () => {
    fail('Operation failed');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('Operation failed');
  });

  it('should print recovery suggestion on second line when provided', () => {
    fail('Operation failed', 'Try running again');
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[0][0]).toContain('Operation failed');
    expect(logSpy.mock.calls[1][0]).toContain('Try running again');
    // Recovery should be indented further
    expect(logSpy.mock.calls[1][0]).toMatch(/^    .*/);
  });
});

describe('ui-helpers.ts > tip', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print info tip', () => {
    tip('Run doctor to verify');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('Run doctor to verify');
  });
});

describe('ui-helpers.ts > formatDuration', () => {
  it('should format milliseconds under 1000 as "ms"', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds under 60 as "Xs"', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('should format minutes as "Xm Ys"', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(125000)).toBe('2m 5s');
    expect(formatDuration(3600000)).toBe('60m 0s');
  });
});

describe('ui-helpers.ts > progress', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((): boolean => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('should write spinner character with message', () => {
    progress('Loading...');
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const call = writeSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/\r.*Loading\.\.\./);
    expect(call).toMatch(/\r  .*/);
  });
});

describe('ui-helpers.ts > clearProgress', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((): boolean => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('should write carriage return and spaces to clear line', () => {
    clearProgress();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const call = writeSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/\r {2,}\r/);
  });
});
