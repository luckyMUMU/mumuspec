/**
 * Tests for executeChat helper: JSON output mode branch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockAnswerQuery = vi.fn();

vi.mock('../../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

describe('executeChat JSON mode', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockAnswerQuery.mockReset();
    mockAnswerQuery.mockReturnValue({
      query: 'test',
      answer: 'Test answer',
      confidence: 'high' as const,
      references: [],
      generated_at: '2026-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should output JSON string when jsonMode is true', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'test', true);

    const calls = logSpy.mock.calls.flat();
    expect(calls.some((c: string) => c.includes('"query"') && c.includes('"test"'))).toBe(true);
  });

  it('should NOT print panel border when jsonMode is true', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'test', true);

    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('CHAT ANSWER')
    );
  });
});
