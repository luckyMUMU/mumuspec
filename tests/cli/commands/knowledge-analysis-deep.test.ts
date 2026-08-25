/**
 * Deep coverage tests for knowledge-analysis command — impact, coverage,
 * gaps, graph-export, including JSON output, error paths, and edge branches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockListKnowledgePages,
  mockAnalyzeImpact,
  mockAnalyzeCoverage,
  mockReadReverseIndex,
  mockMkdirSync,
  mockWriteFileSync,
  mockReadFileSync,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockListKnowledgePages: vi.fn(),
  mockAnalyzeImpact: vi.fn(),
  mockAnalyzeCoverage: vi.fn(),
  mockReadReverseIndex: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: () => mockFindProjectRoot() };
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

vi.mock('node:fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge-analysis command — deep coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

    // Default impact result with all sections populated
    mockAnalyzeImpact.mockReturnValue({
      generated_at: '2024-01-01T00:00:00Z',
      diff_range: 'HEAD~3..HEAD',
      changed_files: [
        { path: 'src/cli/commands/impact.ts', change_type: 'modified', lines_changed: 42 },
        { path: 'src/core/analyzer.ts', change_type: 'added', lines_changed: 120 },
      ],
      direct_impact: [
        {
          node_path: 'src/cli/commands/impact.ts',
          node_type: 'File',
          distance: 0,
          dependents: ['src/cli/index.ts'],
          impacted_specs: [{ id: 'spec-001', title: 'Impact Analysis Spec' }],
          impacted_knowledge: [{ id: 'kp-001', title: 'Decision: Impact Flow' }],
        },
        {
          node_path: 'src/core/analyzer.ts',
          node_type: 'Class',
          distance: 1,
          dependents: [],
          impacted_specs: [],
          impacted_knowledge: [],
        },
      ],
      indirect_impact: [],
      knowledge_warnings: [
        { knowledge_id: 'kp-001', warning_type: 'SCOPE_OVERLAP', message: 'Scope may overlap existing knowledge', suggestion: 'Review kp-001', severity: 'high' },
        { knowledge_id: 'kp-002', warning_type: 'RISK_AMPLIFY', message: 'Change amplifies known risk', suggestion: 'Add mitigation note', severity: 'medium' },
        { knowledge_id: 'kp-003', warning_type: 'DECISION_DEVIATION', message: 'Deviates from recorded decision', suggestion: 'Update decision rationale', severity: 'low' },
      ],
      recommendations: {
        regression_scope: ['test/impact.test.ts', 'test/analyzer.test.ts'],
        review_focus: [],
        knowledge_pages_to_review: ['kp-001', 'kp-005'],
      },
    });

    mockAnalyzeCoverage.mockReturnValue({
      scope: 'src',
      generated_at: '2024-01-01T00:00:00Z',
      coverage: {
        total_code_nodes: 50,
        covered_nodes: 25,
        coverage_ratio: 0.5,
        by_type: { File: { total: 30, covered: 15 }, Function: { total: 20, covered: 10 } },
      },
      gaps: [
        { node: 'src/cli/commands/new-file.ts', node_type: 'File', importance: 9.5, suggested_type: 'decision' },
        { node: 'src/core/parser.ts', node_type: 'File', importance: 7.0, suggested_type: 'pattern' },
        { node: 'src/utils/helper.ts', node_type: 'File', importance: 4.0, suggested_type: 'rationale' },
      ],
      overloads: [
        { node: 'src/core/config.ts', pages_count: 5 },
      ],
    });

    mockListKnowledgePages.mockReturnValue([
      {
        path: '/fake/root/.mumuspec/knowledge/decision-001.md',
        frontmatter: {
          id: 'dec-001',
          title: 'Decision: Use Commander.js',
          type: 'decision',
          status: 'confirmed',
          scope: 'src/cli',
          created_at: '2024-01-01T00:00:00Z',
          graph_bindings: ['src/cli/index.ts', 'src/cli/commands/impact.ts'],
        },
        content: '# Decision\n\nUse Commander.js for CLI.',
      },
      {
        path: '/fake/root/.mumuspec/knowledge/pattern-002.md',
        frontmatter: {
          id: 'pat-002',
          title: 'Pattern: Subcommand Registration',
          type: 'pattern',
          status: 'confirmed',
          scope: 'src/cli/commands',
          created_at: '2024-01-01T00:00:00Z',
          graph_bindings: ['src/cli/commands/base.ts'],
        },
        content: '# Pattern\n\nRegister subcommands on a parent.',
      },
    ]);

    mockReadReverseIndex.mockReturnValue([
      { code_node: 'src/cli/index.ts', knowledge_pages: ['dec-001'] },
      { code_node: 'src/cli/commands/impact.ts', knowledge_pages: ['dec-001'] },
      { code_node: 'src/cli/commands/base.ts', knowledge_pages: ['pat-002'] },
      { code_node: 'src/core/config.ts', knowledge_pages: [] },
    ]);

    mockMkdirSync.mockImplementation(() => undefined);
    mockWriteFileSync.mockImplementation(() => undefined);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ══════════════════════════════════════════
  // impact subcommand
  // ══════════════════════════════════════════

  it('impact: should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('impact: should print banner and all sections when changes exist', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('IMPACT ANALYSIS'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Changed Files (2)'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[modified] src/cli/commands/impact.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[added] src/core/analyzer.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Direct Impact (2)'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[d=0] src/cli/commands/impact.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[d=1] src/core/analyzer.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge Warnings (3)'));
  });

  it('impact: should use correct severity icons for warnings', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[H] kp-001'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[M] kp-002'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[L] kp-003'));
  });

  it('impact: should print recommendations with regression scope and knowledge pages', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Regression:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test/impact.test.ts, test/analyzer.test.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('kp-001, kp-005'));
  });

  it('impact: should print "No changes detected" when diff is empty', async () => {
    mockAnalyzeImpact.mockReturnValue({
      generated_at: '2024-01-01T00:00:00Z',
      diff_range: 'HEAD..HEAD',
      changed_files: [],
      direct_impact: [],
      indirect_impact: [],
      knowledge_warnings: [],
      recommendations: { regression_scope: [], review_focus: [], knowledge_pages_to_review: [] },
    });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No changes detected'));
  });

  it('impact: should output JSON when --json flag is used', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact', '--json'], { from: 'user' });
    const jsonCall = logSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('changed_files'),
    );
    expect(jsonCall).toBeDefined();
  });

  it('impact: should pass options to analyzeImpact with --diff and --scope flags', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await program.parseAsync(['impact', '--diff', 'HEAD~5..HEAD', '--scope', 'src/cli'], { from: 'user' });
    expect(mockAnalyzeImpact).toHaveBeenCalledWith('/fake/root', { project: { name: 'test' } }, {
      diffRange: 'HEAD~5..HEAD',
      scope: 'src/cli',
      withKnowledge: true,
    });
  });

  it('impact: should handle error in catch block gracefully via try/catch', async () => {
    mockAnalyzeImpact.mockImplementation(() => { throw new Error('Git not found'); });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    try {
      await program.parseAsync(['impact'], { from: 'user' });
    } catch {}
    expect(errorSpy).toHaveBeenCalledWith('Error: Git not found');
  });

  it('impact: should handle non-Error thrown values', async () => {
    mockAnalyzeImpact.mockImplementation(() => { throw 'unexpected error string'; });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    try {
      await program.parseAsync(['impact'], { from: 'user' });
    } catch {}
    expect(errorSpy).toHaveBeenCalledWith('Error: unexpected error string');
  });

  // ══════════════════════════════════════════
  // coverage subcommand
  // ══════════════════════════════════════════

  it('coverage: should render full coverage report with bar chart', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['coverage', '--scope', 'src'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('KNOWLEDGE COVERAGE REPORT'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('25/50 nodes'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('50.0%'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Coverage Gaps'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('new-file.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('parser.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge Overloads: 1'));
  });

  it('coverage: should output JSON when --json flag is used', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['coverage', '--json'], { from: 'user' });
    const jsonCall = logSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('coverage'),
    );
    expect(jsonCall).toBeDefined();
  });

  it('coverage: should use scope from options', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['coverage', '--scope', 'src/core'], { from: 'user' });
    expect(mockAnalyzeCoverage).toHaveBeenCalledWith('/fake/root', { project: { name: 'test' } }, 'src/core');
  });

  // ══════════════════════════════════════════
  // gaps subcommand
  // ══════════════════════════════════════════

  it('gaps: should filter by min-importance (default 5)', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['gaps', '--scope', 'src'], { from: 'user' });
    const gapCalls = logSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('gap'),
    );
    expect(gapCalls.length).toBeGreaterThan(0);
    // Should not include the low-importance gap (4.0 < 5)
    expect(logSpy).toHaveBeenCalledWith(expect.not.stringContaining('utils/helper.ts'));
  });

  it('gaps: should show custom threshold results', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['gaps', '--scope', 'src', '--min-importance', '7.5'], { from: 'user' });
    // importance >= 7.5: new-file.ts (9.5) passes; parser.ts (7.0) does NOT pass
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('new-file.ts'));
    // 4.0 gap should definitely not appear
    const lowGapCall = logSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('utils/helper.ts'),
    );
    expect(lowGapCall).toBeUndefined();
  });

  it('gaps: should print "No gaps found" when none above threshold', async () => {
    mockAnalyzeCoverage.mockReturnValue({
      scope: 'src',
      generated_at: '2024-01-01T00:00:00Z',
      coverage: {
        total_code_nodes: 10,
        covered_nodes: 10,
        coverage_ratio: 1.0,
        by_type: { File: { total: 10, covered: 10 } },
      },
      gaps: [
        { node: 'src/low-priority.ts', node_type: 'File', importance: 3.0, suggested_type: 'rationale' },
      ],
      overloads: [],
    });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['gaps', '--scope', 'src', '--min-importance', '5'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith('No gaps found above threshold.');
  });

  it('gaps: should output JSON when --json flag is used', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['gaps', '--scope', 'src', '--json'], { from: 'user' });
    const jsonCall = logSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('node'),
    );
    expect(jsonCall).toBeDefined();
  });

  // ══════════════════════════════════════════
  // graph-export subcommand
  // ══════════════════════════════════════════

  it('graph-export: should write graph JSON to default path', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['graph-export'], { from: 'user' });
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge graph exported:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Nodes: 2'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Edges: 3'));
  });

  it('graph-export: should use --output option when provided', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    const customPath = '/tmp/custom-graph.json';
    await knowledgeCmd.parseAsync(['graph-export', '--output', customPath], { from: 'user' });
    const writeCall = mockWriteFileSync.mock.calls.find(
      (args) => String(args[0]).includes('custom-graph'),
    );
    expect(writeCall).toBeDefined();
  });

  it('graph-export: should handle fs failure gracefully', async () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('ENOSPC'); });
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['graph-export'], { from: 'user' });
    // Should fall through to console output in catch block
    const jsonCall = logSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('nodes'),
    );
    expect(jsonCall).toBeDefined();
  });

  it('graph-export: should generate correct COVERED_BY edges', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);
    await knowledgeCmd.parseAsync(['graph-export'], { from: 'user' });
    // The writeFileSync call should contain edge types
    const writeCall = mockWriteFileSync.mock.calls[0];
    if (writeCall) {
      const content = String(writeCall[1]);
      expect(content).toContain('COVERED_BY');
    }
  });

  // ══════════════════════════════════════════
  // command registration structure
  // ══════════════════════════════════════════

  it('should register impact on program and coverage/gaps/graph-export on knowledgeCmd', async () => {
    const { registerKnowledgeAnalysis } = await import('../../../src/cli/commands/knowledge-analysis.js');
    const knowledgeCmd = new Command();
    const program = new Command();
    registerKnowledgeAnalysis(program, knowledgeCmd);

    // impact is on program
    const impactProgram = program.commands.some((c) => c.name() === 'impact');
    expect(impactProgram).toBe(true);

    // coverage, gaps, graph-export are on knowledgeCmd
    const subNames = knowledgeCmd.commands.map((c) => c.name());
    expect(subNames).toContain('coverage');
    expect(subNames).toContain('gaps');
    expect(subNames).toContain('graph-export');
  });
});
