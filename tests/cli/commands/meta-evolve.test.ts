/**
 * Tests for meta-evolve CLI command (R-0005 TC-META-09, TC-META-10).

 * Strategy: mock findProjectRoot + meta-evolve module, register command on a
 * fresh Commander program, invoke via parseAsync().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

const { registerMetaEvolveCommand } = await import('../../../src/cli/commands/meta-evolve.js');

function createProgram(): Command {
  const program = new Command();
  registerMetaEvolveCommand(program);
  return program;
}

describe('meta-evolve command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue('/fake/project');
  });

  // TC-META-09
  it('--analyze outputs score report header', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--analyze']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Effectiveness Score Report');
  });

  // TC-META-10
  it('--apply without --confirm is rejected', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--apply']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--confirm'),
    );
  });

  it('--apply --confirm fails closed (P0-3: not implemented — exit 1, no fake success)', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--apply', '--confirm']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not implemented'));
  });

  it('--propose outputs markdown proposal', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--propose']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('# Meta-Spec Evolution Proposal');
  });

  // P0-2 (self-improvement-loop-p0): 空数据集与健康必须可区分
  it('--analyze prints "No check records accumulated yet" when stats empty (honest, not fake health)', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--analyze']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No check records accumulated yet.');
  });

  it('--propose does NOT claim "Constraints are healthy" on empty data', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--propose']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('无法评估约束健康度');
    expect(output).not.toContain('Constraints are healthy');
  });

  it('--analyze declares knowledge index unavailable when index file missing (P0-2)', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--analyze']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('knowledge index unavailable — skipped');
  });

  it('exits when not in a mumuspec project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'meta-evolve', '--analyze']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});
