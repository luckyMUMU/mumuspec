/**
 * Handler-level tests for knowledge-doctor command.
 *
 * Tests the registerKnowledgeDoctor handler logic including:
 * - --json output mode
 * - Plain text report rendering
 * - Default sources parsing (--sources flag)
 * - All severity level branches (error, warn, info)
 * - Empty findings summary path
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock knowledge/doctor.js ──
const mockRunDiagnosis = vi.fn();

vi.mock('../../../src/knowledge/doctor.js', () => ({
  runDiagnosis: mockRunDiagnosis,
}));

// ── Mock core/utils.js ──
const mockFindProjectRoot = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

// Fixtures
function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: '2024-06-15T10:30:00.000Z',
    findings: [],
    stats: {
      totalKnowledgePages: 12,
      proposedFromScan: 5,
      sourcesCovered: ['deps', 'code', 'git', 'docs'],
    },
    summary: '知识库状态良好，未发现问题。',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge-doctor handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockRunDiagnosis.mockReturnValue(makeReport());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should output JSON when --json flag is used', async () => {
    const report = makeReport();
    mockRunDiagnosis.mockReturnValue(report);

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor', '--json'], { from: 'user' });

    // Should log JSON.stringify of the report
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(report, null, 2)
    );
  });

  it('should print plain text header in non-JSON mode', async () => {
    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('='.repeat(60));
    expect(logSpy).toHaveBeenCalledWith('知识库诊断报告');
  });

  it('should print stats line in plain text mode', async () => {
    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('现有知识页')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('扫描提议')
    );
  });

  it('should print "ok" message when no findings', async () => {
    mockRunDiagnosis.mockReturnValue(makeReport({ findings: [] }));

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('知识库状态良好')
    );
  });

  it('should print error findings with affectedScope and suggestion', async () => {
    mockRunDiagnosis.mockReturnValue(
      makeReport({
        findings: [
          {
            severity: 'error',
            category: 'missing',
            message: '知识库目录不存在',
            suggestion: '运行 mumuspec knowledge init',
            affectedScope: 'project',
          },
        ],
        summary: '诊断发现 1 个错误。',
      })
    );

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('严重问题 (1)');
    expect(calls).toContain('知识库目录不存在');
    expect(calls).toContain('范围: project');
    expect(calls).toContain('建议: 运行 mumuspec knowledge init');
  });

  it('should print warn findings', async () => {
    mockRunDiagnosis.mockReturnValue(
      makeReport({
        findings: [
          {
            severity: 'warn',
            category: 'gap',
            message: 'pages/ 目录为空',
            suggestion: '运行 scan',
          },
        ],
        summary: '诊断发现 1 个警告。',
      })
    );

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('警告 (1)');
    expect(calls).toContain('pages/ 目录为空');
  });

  it('should print info findings', async () => {
    mockRunDiagnosis.mockReturnValue(
      makeReport({
        findings: [
          {
            severity: 'info',
            category: 'coverage',
            message: '扫描发现 5 条潜在知识',
            suggestion: '运行 scan 查看',
          },
        ],
        summary: '诊断发现 1 条信息。',
      })
    );

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('提示 (1)');
    expect(calls).toContain('扫描发现 5 条潜在知识');
  });

  it('should print summary at the end', async () => {
    mockRunDiagnosis.mockReturnValue(
      makeReport({
        findings: [
          {
            severity: 'error',
            category: 'missing',
            message: 'error msg',
            suggestion: 'fix it',
          },
        ],
        summary: '诊断发现 1 个错误。 另有 3 条来自扫描的潜在知识待审阅。',
      })
    );

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('诊断发现 1 个错误。 另有 3 条来自扫描的潜在知识待审阅。');
  });

  it('should print disclaimer at the end', async () => {
    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('此为诊断报告，未修改任何文件。');
  });

  it('should pass sources filter to runDiagnosis when --sources is given', async () => {
    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor', '--sources', 'deps', 'code'], { from: 'user' });

    expect(mockRunDiagnosis).toHaveBeenCalledWith(
      '/fake/root',
      { sources: ['deps', 'code'] }
    );
  });

  it('should pass undefined sources to runDiagnosis when --sources is "all"', async () => {
    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor', '--sources', 'all'], { from: 'user' });

    expect(mockRunDiagnosis).toHaveBeenCalledWith(
      '/fake/root',
      { sources: undefined }
    );
  });

  it('should count findings correctly across all severities', async () => {
    mockRunDiagnosis.mockReturnValue(
      makeReport({
        findings: [
          { severity: 'error', category: 'missing', message: 'e1', suggestion: 's1' },
          { severity: 'error', category: 'conflict', message: 'e2', suggestion: 's2' },
          { severity: 'warn', category: 'gap', message: 'w1', suggestion: 's3' },
          { severity: 'info', category: 'coverage', message: 'i1', suggestion: 's4' },
        ],
        summary: '诊断发现 2 个错误、1 个警告、1 条信息。',
      })
    );

    const { registerKnowledgeDoctor } = await import('../../../src/cli/commands/knowledge-doctor.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeDoctor(knowledgeCmd);

    await program.parseAsync(['knowledge', 'doctor'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('严重问题 (2)');
    expect(calls).toContain('警告 (1)');
    expect(calls).toContain('提示 (1)');
  });
});
