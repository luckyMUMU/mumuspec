/**
 * Extra tests for knowledge-analysis command — impact, coverage, gaps.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockListKnowledgePages = vi.fn();
const mockAnalyzeImpact = vi.fn();
const mockAnalyzeCoverage = vi.fn();
const mockReadReverseIndex = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: () => mockLoadConfig(),
}));

vi.mock('../../../src/knowledge/manager.js', () => ({
  listKnowledgePages: (...args: unknown[]) => mockListKnowledgePages(...args),
  analyzeImpact: (...args: unknown[]) => mockAnalyzeImpact(...args),
  analyzeCoverage: (...args: unknown[]) => mockAnalyzeCoverage(...args),
  readReverseIndex: (...args: unknown[]) => mockReadReverseIndex(...args),
}));

describe('knowledge-analysis command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockAnalyzeImpact.mockReturnValue({ changed_files: [], warnings: [], knowledge_gaps: [] });
    mockAnalyzeCoverage.mockReturnValue({ coverage: { coverage_ratio: 0.5, total_code_nodes: 10, covered_nodes: 5 }, gaps: [], overloads: [] });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('impact: should exit(1) when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('impact: should return "no changes" when diff is empty', async () => {
    mockAnalyzeImpact.mockReturnValue({ changed_files: [], warnings: [] });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No changes'));
  });

  it('coverage: should render report', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['knowledge', 'coverage'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('COVERAGE REPORT'));
  });

  it('coverage: should output JSON with --json', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['knowledge', 'coverage', '--json'], { from: 'user' });
    const jsonCall = logSpy.mock.calls.find(c => String(c[0]).includes('coverage'));
    expect(jsonCall).toBeDefined();
  });

  it('gaps: should filter by min-importance', async () => {
    mockAnalyzeCoverage.mockReturnValue({
      coverage: { coverage_ratio: 0.3, total_code_nodes: 20, covered_nodes: 6 },
      gaps: [
        { node: 'src/foo.ts', importance: 8.5 },
        { node: 'src/bar.ts', importance: 2.0 },
      ],
      overloads: [],
    });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['knowledge', 'gaps', '--scope', 'src', '--min-importance', '5'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('foo.ts'));
  });
});
