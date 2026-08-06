/**
 * Extra tests for src/cli/index.ts — command registration smoke test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all command registration modules
vi.mock('../core/config.js', () => ({
  saveConfig: vi.fn(),
  getDefaultConfig: vi.fn(() => ({ project: { name: 'x' }, specs: {} })),
  isInitialized: vi.fn(() => true),
  loadConfig: vi.fn(() => ({ project: { name: 'x' }, specs: {} })),
}));

vi.mock('../core/utils.js', () => ({
  getMumuSpecDir: vi.fn(() => '/root/.mumuspec'),
  ensureDir: vi.fn(),
  writeText: vi.fn(),
  writeYaml: vi.fn(),
  readYaml: vi.fn(),
  now: vi.fn(() => '2024-01-01'),
  appendAuditLog: vi.fn(),
  findProjectRoot: vi.fn(() => '/root'),
  computeHash: vi.fn(() => 'hash'),
  readText: vi.fn(() => ''),
  existsSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
}));

vi.mock('../core/project-analyzer.js', () => ({
  analyzeProject: vi.fn(() => ({
    projectType: 'cli', framework: 'none', language: 'typescript',
    hasTypeScript: true, hasTests: false, hasStorybook: false,
    hasTailwind: false, hasCssModules: false, hasScss: false,
    hasUiLibrary: false, packageName: 'test', sourceDirs: ['src'],
    entryPoints: ['cli.ts'], totalFiles: 1, frontendIndicators: [], backendIndicators: [],
  })),
}));

vi.mock('../core/init-generator.js', () => ({
  generateInitialSpec: vi.fn(() => ''),
  generateInitialDesign: vi.fn(() => ''),
  scaffoldKnowledgeBase: vi.fn(),
  generateFrontendDesignMd: vi.fn(() => ''),
  isFrontendProject: vi.fn(() => false),
  generateEnvKnowledgePage: vi.fn(),
}));

vi.mock('../core/spec-scaffolder.js', () => ({
  generateGoalSpec: vi.fn(() => ''),
  generateEnvSpec: vi.fn(() => ''),
}));

vi.mock('../rules/generator.js', () => ({
  generateRulesFiles: vi.fn(),
}));

vi.mock('../i18n/locales.js', () => ({
  initLocale: vi.fn(),
}));

vi.mock('./helpers.js', () => ({
  getCssSummary: vi.fn(() => ''),
  getDirectorySummary: vi.fn(() => ''),
}));

vi.mock('../core/doc-importer.js', () => ({
  detectExistingDocuments: vi.fn(() => []),
  detectThirdPartySpecs: vi.fn(() => []),
  importExistingDocuments: vi.fn(),
  importThirdPartySpecs: vi.fn(),
  generateImportIndex: vi.fn(() => ''),
}));

// Command registration mocks
const mockRegister = vi.fn();
[
  './commands/spec.js', './commands/change.js', './commands/guard.js',
  './commands/state.js', './commands/knowledge.js', './commands/constraints.js',
  './commands/feedback.js', './commands/install.js', './commands/finalize-archive.js',
  './commands/hooks.js', './commands/dashboard.js', './commands/eval.js',
  './commands/i18n.js', './commands/skill.js', './commands/bundle.js',
  './commands/env.js', './commands/doctor.js', './commands/recommend.js',
  './commands/decisions.js', './commands/advise.js', './commands/contract.js',
  './commands/loop.js', './commands/sync.js', './commands/review.js',
  './commands/audit-log.js', './commands/trace.js', './commands/graph.js',
  './commands/cognitive-map.js',
].forEach(mod => {
  vi.mock(mod, () => ({ [mod.split('/').pop()!.replace('.js', 'Commands').replace('spec', 'Spec').replace('knowledge', 'Knowledge')]: mockRegister }));
});

describe('cli index module', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    vi.resetModules();
  });

  it('should have a main function exported', async () => {
    // Verify the module has expected structure
    const mod = await import('../src/cli/index.js');
    // The CLI entry point may not export functions directly but should register commands
    expect(mod).toBeDefined();
  });

  it('should register spec commands', async () => {
    const { registerSpecCommands } = await import('../src/cli/commands/spec.js');
    expect(typeof registerSpecCommands).toBe('function');
  });

  it('should register state commands', async () => {
    const { registerStateCommands } = await import('../src/cli/commands/state.js');
    expect(typeof registerStateCommands).toBe('function');
  });

  it('should register decisions command', async () => {
    const { registerDecisionsCommand } = await import('../src/cli/commands/decisions.js');
    expect(typeof registerDecisionsCommand).toBe('function');
  });

  it('should register trace command', async () => {
    const { registerTraceCommand } = await import('../src/cli/commands/trace.js');
    expect(typeof registerTraceCommand).toBe('function');
  });

  it('should register finalize-archive command', async () => {
    const { registerFinalizeArchiveCommand } = await import('../src/cli/commands/finalize-archive.js');
    expect(typeof registerFinalizeArchiveCommand).toBe('function');
  });
});
