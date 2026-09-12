/**
 * Hotfix tests for `mumuspec check` (LOOP-4 P0):
 *  - L1: `--json` aggregates compliance + drift + glossary into one payload
 *        and exits with the real code (no false green).
 *  - L2: check action try/catch degrades subsystem throws to E-CHECK-001 + exit 1.
 *  - L3: BOUNDARY.md command list matches src/cli/index.ts registrations.
 *
 * Strategy: mock findProjectRoot/loadConfig/guard modules, register spec
 * commands, then drive commander in-process (same pattern as spec-handler.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..');

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockCheckCompliance,
  mockDetectDriftWithContracts,
  mockDetectAgentsDrift,
  mockCheckGlossary,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCheckCompliance: vi.fn(),
  mockDetectDriftWithContracts: vi.fn(() => []),
  mockDetectAgentsDrift: vi.fn(() => []),
  mockCheckGlossary: vi.fn(() => ({ findings: [], count: 0 })),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../../src/guard/checker.js', () => ({
  checkCompliance: mockCheckCompliance,
  detectDrift: vi.fn(() => []),
  autoFixDrift: vi.fn(() => ({ fixed: [], remaining: [] })),
  detectDriftWithContracts: mockDetectDriftWithContracts,
  detectAgentsDrift: mockDetectAgentsDrift,
}));

vi.mock('../../../src/guard/glossary-checker.js', () => ({
  checkGlossary: mockCheckGlossary,
}));

// Import after mocks
const { registerSpecCommands } = await import('../../../src/cli/commands/spec.js');

function createProgram(): Command {
  const program = new Command();
  registerSpecCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';
const DEFAULT_CONFIG = { constraint_strength: { technical_design: 'high', requirement_goals: 'high' } };

function jsonPayloadFromLogs(logSpy: ReturnType<typeof vi.spyOn>): any {
  const call = logSpy.mock.calls.find(
    (c) => typeof c[0] === 'string' && c[0].trim().startsWith('{'),
  );
  expect(call, 'expected a JSON console.log call').toBeDefined();
  return JSON.parse(call![0] as string);
}

describe('check --json aggregation (LOOP-4 L1)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(DEFAULT_CONFIG);
    mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockDetectDriftWithContracts.mockReturnValue([]);
    mockDetectAgentsDrift.mockReturnValue([]);
    mockCheckGlossary.mockReturnValue({ findings: [], count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-L1-1: --json output contains compliance and drift fields', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'check', '--json']);

    const payload = jsonPayloadFromLogs(logSpy);
    expect(payload.compliance).toBeDefined();
    expect(payload.compliance.passed).toBe(true);
    expect(payload.drift).toBeDefined();
    expect(Array.isArray(payload.drift.errors)).toBe(true);
    expect(Array.isArray(payload.drift.warnings)).toBe(true);
    expect(payload.exitCode).toBe(0);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('TC-L1-2: drift ERROR → --json payload has exitCode 1 and process exits 1', async () => {
    mockDetectDriftWithContracts.mockReturnValue([
      { type: 'spec-drift', message: 'Spec without implementation', file: 'src/x.ts', severity: 'ERROR' },
    ]);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'check', '--json']))
      .rejects.toThrow('process.exit called with code 1');

    const payload = jsonPayloadFromLogs(logSpy);
    expect(payload.drift.errors).toHaveLength(1);
    expect(payload.drift.errors[0].severity).toBe('ERROR');
    expect(payload.exitCode).toBe(1);
  });

  it('TC-L1-3: --glossary + --json includes glossary result in the payload', async () => {
    mockCheckGlossary.mockReturnValue({
      findings: [{ file: 'src/a.ts', line: 3, type: 'rollback', pattern: '回滚', suggestion: '回退' }],
      count: 1,
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'check', '--glossary', '--json']);

    const payload = jsonPayloadFromLogs(logSpy);
    expect(payload.glossary).toBeDefined();
    expect(payload.glossary.count).toBe(1);
    expect(payload.glossary.findings).toHaveLength(1);
    // Non-strict glossary finding alone must NOT fail the check
    expect(payload.exitCode).toBe(0);
  });

  it('TC-L1-3b: --glossary --strict failure is reflected in JSON exitCode', async () => {
    mockCheckGlossary.mockReturnValue({
      findings: [{ file: 'src/a.ts', line: 3, type: 'rollback', pattern: '回滚', suggestion: '回退' }],
      count: 1,
    });

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'check', '--glossary', '--strict', '--json']))
      .rejects.toThrow('process.exit called with code 1');

    const payload = jsonPayloadFromLogs(logSpy);
    expect(payload.glossary.count).toBe(1);
    expect(payload.exitCode).toBe(1);
  });
});

describe('check action error handling (LOOP-4 L2)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(DEFAULT_CONFIG);
    mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockDetectDriftWithContracts.mockReturnValue([]);
    mockDetectAgentsDrift.mockReturnValue([]);
    mockCheckGlossary.mockReturnValue({ findings: [], count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-L2-1: checkCompliance throws → E-CHECK-001 + exit 1, no crash', async () => {
    mockCheckCompliance.mockImplementation(() => {
      throw new Error('boom: checker exploded');
    });

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'check']))
      .rejects.toThrow('process.exit called with code 1');

    const errCall = errorSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('E-CHECK-001'),
    );
    expect(errCall).toBeDefined();
    expect(errCall![0]).toContain('CHECK_ACTION_FAILED'); // registered in errors.ts
  });

  it('TC-L2-1b: drift 源抛错 → 逐源隔离为 W-CHECK-002（盲区恒可见），其余源与合规结论不受影响', async () => {
    mockDetectDriftWithContracts.mockImplementation(() => {
      throw new Error('drift exploded');
    });

    const program = createProgram();
    // 合规检查通过 → check 正常完成。单个 drift 源失败不再拖垮整个 check
    // （旧行为会把其余源已产出的发现全部丢在一句 E-CHECK-001 后面）。
    await program.parseAsync(['node', 'mumuspec', 'check', '--json']);

    const payload = jsonPayloadFromLogs(logSpy) as {
      compliance: { passed: boolean };
      drift: { errors: { code?: string }[]; warnings: { code?: string; type: string; message: string }[] };
      exitCode: number;
    };

    // 盲区必须上报，不许静默
    const failed = payload.drift.warnings.find((d) => d.code === 'W-CHECK-002');
    expect(failed, 'failed drift source must surface as a visible warning').toBeDefined();
    expect(failed!.type).toBe('drift_source_failed');
    expect(failed!.message).toContain('drift exploded');
    expect(failed!.message).toContain('guard-contracts');

    // 其余源与合规结论存活，退出码只反映真实合规状态
    expect(payload.drift.errors).toEqual([]);
    expect(payload.compliance.passed).toBe(true);
    expect(payload.exitCode).toBe(0);
  });
});

describe('BOUNDARY.md ↔ index.ts command list (LOOP-4 L3)', () => {
  it('TC-L3-1: every register* call in index.ts is listed in BOUNDARY.md', () => {
    const indexSrc = readFileSync(resolve(ROOT, 'src/cli/index.ts'), 'utf8');
    const boundary = readFileSync(resolve(ROOT, 'src/cli/commands/.mumuspec/BOUNDARY.md'), 'utf8');

    const registered = new Set(
      [...indexSrc.matchAll(/register([A-Za-z0-9]+)\(program\)/g)].map((m) => `register${m[1]}`),
    );
    const boundaryListed = new Set(
      [...boundary.matchAll(/\| `(register[A-Za-z0-9]+)` \|/g)].map((m) => m[1]),
    );

// index.ts calls must all appear in the BOUNDARY table
for (const fn of registered) {
  expect(boundaryListed.has(fn), `missing in BOUNDARY.md: ${fn}`).toBe(true);
}
// BOUNDARY must not list functions that index.ts no longer calls
for (const fn of boundaryListed) {
  expect(registered.has(fn), `listed in BOUNDARY.md but not registered: ${fn}`).toBe(true);
}
expect(registered.size).toBe(36);
expect(boundaryListed.size).toBe(36);
  });

  it('TC-L3-1b: BOUNDARY.md attributes `check` to spec.ts (not guard.ts)', () => {
    const boundary = readFileSync(resolve(ROOT, 'src/cli/commands/.mumuspec/BOUNDARY.md'), 'utf8');
    expect(boundary).toMatch(/check[\s\S]{0,80}spec\.ts/);
    // spec row must mention check
    const specRow = boundary.split('\n').find((l) => l.includes('`registerSpecCommands`'));
    expect(specRow).toBeDefined();
    expect(specRow!).toContain('check');
    expect(specRow!).toContain('spec.ts');
    // no stale claim that guard.ts owns check
    expect(boundary).not.toMatch(/\| `registerGuardCommand`[^\n]*check/);
  });
});
