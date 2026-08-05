/**
 * Tests for CLI helper functions — src/cli/helpers.ts (executeChat) and ui-helpers.ts boundary cases.
 *
 * Extends tests/cli/helpers.test.ts with:
 * - executeChat (JSON mode + panel mode, requires knowledge/manager mock)
 * - Additional boundary tests for formatDuration, fail, getCssSummary
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

// ── Mock knowledge/manager before importing helpers ──────────────────────
const mockAnswerQuery = vi.fn();
vi.mock('../../src/knowledge/manager.js', () => ({
  answerQuery: (...args: unknown[]) => mockAnswerQuery(...args),
}));

const { executeChat } = await import('../../src/cli/helpers.js');
const {
  resetSteps,
  step,
  success,
  warn,
  fail,
  tip,
  formatDuration,
} = await import('../../src/cli/ui-helpers.js');
const { getCssSummary } = await import('../../src/cli/helpers.js');

// ════════════════════════════════════════════════════════════════════
// executeChat (src/cli/helpers.ts)
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > executeChat', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  const config = {
    version: '0.17.0',
    project: { name: 'test', language: 'typescript' },
    specs: { root: '.mumuspec/specs', format: 'yaml', max_layer_depth: 3, auto_index: true, require_design_doc: true },
  } as unknown as MumuSpecConfig;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
    mockAnswerQuery.mockReset();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print valid JSON when jsonMode is true', () => {
    const chatAnswer = {
      query: 'anything',
      generated_at: '2025-01-01T00:00:00Z',
      answer: 'Test answer',
      references: [],
      confidence: 'high' as const,
    };
    mockAnswerQuery.mockReturnValue(chatAnswer);

    executeChat('/fake/root', config, 'anything', true);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.answer).toBe('Test answer');
    expect(parsed.confidence).toBe('high');
  });

  it('should call answerQuery with correct arguments in JSON mode', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'test',
      generated_at: 'now',
      answer: 'ok',
      references: [],
      confidence: 'medium' as const,
    });

    executeChat('/my/project', config, 'test', true);
    expect(mockAnswerQuery).toHaveBeenCalledWith('/my/project', config, 'test');
  });

  it('should print panel-style output when jsonMode is false', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'what is X',
      generated_at: '2025-01-01T00:00:00Z',
      answer: 'X is a thing',
      references: [],
      confidence: 'low' as const,
    });

    executeChat('/fake/root', config, 'what is X', false);

    // Panel output: empty line + 4 panel lines + empty line + answer + empty line = 7 calls
    const allCalls = logSpy.mock.calls.map((c) => c[0] as string);
    const joined = allCalls.join('\n');
    expect(joined).toContain('CHAT ANSWER');
    expect(joined).toContain('what is X');
    expect(joined).toContain('low');
    expect(joined).toContain('X is a thing');
  });

  it('should print references section when references exist', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'ref test',
      generated_at: '2025-01-01T00:00:00Z',
      answer: 'Answer with refs',
      references: [
        { id: 'page-1', title: 'Page One', type: 'decision' as const, relevance: 0.95 },
        { id: 'page-2', title: 'Page Two', type: 'pattern' as const, relevance: 0.72 },
      ],
      confidence: 'medium' as const,
    });

    executeChat('/fake/root', config, 'ref test', false);

    const allCalls = logSpy.mock.calls.map((c) => c[0] as string);
    const joined = allCalls.join('\n');
    expect(joined).toContain('References:');
    expect(joined).toContain('[page-1] Page One (decision, 95%)');
    expect(joined).toContain('[page-2] Page Two (pattern, 72%)');
  });

  it('should not print references section when empty', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'no refs',
      generated_at: '2025-01-01T00:00:00Z',
      answer: 'Simple answer',
      references: [],
      confidence: 'high' as const,
    });

    executeChat('/fake/root', config, 'no refs', false);

    const allCalls = logSpy.mock.calls.map((c) => c[0] as string);
    const joined = allCalls.join('\n');
    expect(joined).not.toContain('References:');
  });

  it('should default to panel mode when jsonMode is undefined', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'default',
      generated_at: 'now',
      answer: 'Default mode answer',
      references: [],
      confidence: 'high' as const,
    });

    executeChat('/fake/root', config, 'default');

    const allCalls = logSpy.mock.calls.map((c) => c[0] as string);
    const joined = allCalls.join('\n');
    expect(joined).toContain('CHAT ANSWER');
  });
});

// ════════════════════════════════════════════════════════════════════
// helpers.ts > getCssSummary — boundary cases
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > getCssSummary (boundary)', () => {
  it('should not include uiLibrary name when hasUiLibrary is false even if uiLibrary is set', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: false,
      hasUiLibrary: false,
      uiLibrary: 'Ant Design',
    } as ProjectAnalysis;
    // uiLibrary should be ignored when hasUiLibrary is false
    expect(getCssSummary(analysis)).toBe('none detected');
  });

  it('should handle only css modules', () => {
    const analysis = {
      hasTailwind: false,
      hasScss: false,
      hasCssModules: true,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('CSS Modules');
  });

  it('should combine tailwind + scss without UI lib', () => {
    const analysis = {
      hasTailwind: true,
      hasScss: true,
      hasCssModules: true,
      hasUiLibrary: false,
    } as ProjectAnalysis;
    expect(getCssSummary(analysis)).toBe('Tailwind + SCSS + CSS Modules');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > formatDuration — boundary cases
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > formatDuration (boundary)', () => {
  it('should handle zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('should format exactly 1000ms as 1.0s', () => {
    expect(formatDuration(1000)).toBe('1.0s');
  });

  it('should format exactly 60000ms as 1m 0s', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
  });

  it('should round seconds to one decimal under 60s', () => {
    expect(formatDuration(1234)).toBe('1.2s');
    expect(formatDuration(1567)).toBe('1.6s');
  });

  it('should handle very large durations', () => {
    expect(formatDuration(3_600_000)).toBe('60m 0s');
  });

  it('should handle exactly 59.9s boundary', () => {
    expect(formatDuration(59_900)).toBe('59.9s');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > fail — boundary cases
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > fail (boundary)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should print single line when recovery is empty string', () => {
    fail('Something failed', '');
    // Empty string is falsy → only one console.log call
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('Something failed');
  });

  it('should always use ✗ symbol for fail', () => {
    fail('Error');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('✗');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > success — output format
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > success (format)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should always prefix with ✓ symbol', () => {
    success('All good');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toBe('  ✓ All good');
  });

  it('should handle empty message', () => {
    success('');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe('  ✓ ');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > warn — output format
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > warn (format)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should always use ⚠ symbol', () => {
    warn('Watch out');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('⚠');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > tip — output format
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > tip (format)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should always use ℹ symbol', () => {
    tip('helpful hint');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('ℹ');
  });
});

// ════════════════════════════════════════════════════════════════════
// ui-helpers.ts > step / resetSteps — state persistence
// ════════════════════════════════════════════════════════════════════

describe('ui-helpers.ts > step counter persistence', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetSteps();
    logSpy = vi.spyOn(console, 'log').mockImplementation((): void => { /* noop */ });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should maintain monotonically increasing counter without reset', () => {
    step('a');
    step('b');
    step('c');
    step('d');
    step('e');
    expect(logSpy.mock.calls[0][0]).toMatch(/\[1\]/);
    expect(logSpy.mock.calls[1][0]).toMatch(/\[2\]/);
    expect(logSpy.mock.calls[2][0]).toMatch(/\[3\]/);
    expect(logSpy.mock.calls[3][0]).toMatch(/\[4\]/);
    expect(logSpy.mock.calls[4][0]).toMatch(/\[5\]/);
  });

  it('should restart counter from 1 after reset', () => {
    step('first');
    step('second');
    resetSteps();
    step('after reset');
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy.mock.calls[2][0]).toMatch(/\[1\].*after reset/);
  });

  it('should handle empty message gracefully', () => {
    step('');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[1\]/);
  });
});
