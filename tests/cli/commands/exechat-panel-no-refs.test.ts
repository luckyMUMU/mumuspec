/**
 * Tests for executeChat helper: panel display mode without references.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockAnswerQuery = vi.fn();

vi.mock('../../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

describe('executeChat panel mode without references', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockAnswerQuery.mockReset();
    mockAnswerQuery.mockReturnValue({
      query: 'empty',
      answer: 'No refs here',
      confidence: 'low' as const,
      references: [],
      generated_at: '2026-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should NOT print References when references array is empty', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'empty', false);

    expect(logSpy).not.toHaveBeenCalledWith('References:');
  });

  it('should still print panel and answer when no references', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'empty', false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHAT ANSWER'));
    expect(logSpy).toHaveBeenCalledWith('No refs here');
  });

  it('should display low confidence correctly', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'empty', false);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Confidence: low')
    );
  });
});
