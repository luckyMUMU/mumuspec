/**
 * Extra handler tests for knowledge-scan command.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockRunScan = vi.fn();
const mockListScanSources = vi.fn(() => ['deps', 'code', 'git', 'docs']);
const mockGetSourceDescription = vi.fn(() => 'desc');

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../../../src/knowledge/scan.js', () => ({
  runScan: (...args: unknown[]) => mockRunScan(...args),
  listScanSources: (...args: unknown[]) => mockListScanSources(...args),
  getSourceDescription: (...args: unknown[]) => mockGetSourceDescription(...args),
}));

describe('knowledge-scan command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockRunScan.mockReturnValue({
      sources: [
        { source: 'deps', proposedPages: [{ id: '1', title: 'd', type: 'decision', confidence: 'high', source: 'deps', tags: [] }], scannedCount: 1, durationMs: 10 },
      ],
      totalProposed: 1,
      byConfidence: { high: 1, medium: 0, low: 0 },
      byType: { decision: 1 },
      totalDurationMs: 50,
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should print "no knowledge" message when scan returns empty', async () => {
    mockRunScan.mockReturnValue({ sources: [], totalProposed: 0, byConfidence: { high: 0, medium: 0, low: 0 }, byType: {}, totalDurationMs: 10 });
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('未发现'));
  });

  it('should print results with total proposed', async () => {
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1'));
  });

  it('should scan with --from option filtering sources', async () => {
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan', '--from', 'deps'], { from: 'user' });
    expect(mockRunScan).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ sources: ['deps'] }));
  });

  it('sources subcommand should list all sources', async () => {
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan', 'sources'], { from: 'user' });
    expect(mockListScanSources).toHaveBeenCalled();
  });

  it('should exit(1) when no valid sources specified', async () => {
    const { registerKnowledgeScan } = await import('../../../src/cli/commands/knowledge-scan.js');
    const knowledgeCmd = new Command('knowledge');
    registerKnowledgeScan(knowledgeCmd);
    await knowledgeCmd.parseAsync(['scan', '--from', 'invalid'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: 至少指定一个有效来源');
  });
});
