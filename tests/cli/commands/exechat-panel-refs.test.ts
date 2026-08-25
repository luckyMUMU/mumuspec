/**
 * Tests for executeChat helper: panel display mode with references.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockAnswerQuery = vi.fn();

vi.mock('../../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

describe('executeChat panel mode with references', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockAnswerQuery.mockReset();
    mockAnswerQuery.mockReturnValue({
      query: 'saga',
      answer: 'Saga is a pattern',
      confidence: 'medium' as const,
      references: [
        { id: 'KP-0007', title: 'Saga Pattern', type: 'pattern' as const, relevance: 0.95 },
      ],
      generated_at: '2026-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should display panel header and query', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHAT ANSWER'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('saga'));
  });

  it('should display confidence', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Confidence: medium'));
  });

  it('should print answer body', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith('Saga is a pattern');
  });

  it('should print references section with each ref', async () => {
    const { executeChat } = await import('../../../src/cli/helpers.js');
    executeChat('/root', {} as never, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith('References:');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('KP-0007'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Saga Pattern'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('95%'));
  });
});
