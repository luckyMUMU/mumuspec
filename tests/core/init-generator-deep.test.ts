/**
 * Deep tests for src/core/init-generator.ts — targeting uncovered branches:
 * - Lines 185-186: rust ecosystem case in generateEnvKnowledgePage
 * - Lines 232-242: hasTests branch in getInitialKnowledgePages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── hoisted mock references ──────────────────────────────────────────────
const {
  mockWriteText,
  mockWriteYaml,
  mockEnsureDir,
  mockNow,
  mockDetectEnvironment,
  mockSaveEnvSpec,
  mockDetectRequiredEcosystems,
} = vi.hoisted(() => ({
  mockWriteText: vi.fn(),
  mockWriteYaml: vi.fn(),
  mockEnsureDir: vi.fn(),
  mockNow: vi.fn(() => '2024-01-01 00:00:00'),
  mockDetectEnvironment: vi.fn(),
  mockSaveEnvSpec: vi.fn(),
  mockDetectRequiredEcosystems: vi.fn(() => []),
}));

// ── vi.mock registrations ─────────────────────────────────────────────────
vi.mock('../../src/core/utils.js', () => ({
  writeText: (...args: unknown[]) => mockWriteText(...args),
  writeYaml: (...args: unknown[]) => mockWriteYaml(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  now: () => mockNow(),
}));

vi.mock('../../src/core/env-detector.js', () => ({
  detectEnvironment: (...args: unknown[]) => mockDetectEnvironment(...args),
  saveEnvSpec: (...args: unknown[]) => mockSaveEnvSpec(...args),
  detectRequiredEcosystems: (...args: unknown[]) => mockDetectRequiredEcosystems(...args),
}));

// ── imports (after mocks) ─────────────────────────────────────────────────
import {
  generateInitialKnowledgeIndex,
  scaffoldKnowledgeBase,
  generateEnvKnowledgePage,
  isFrontendProject,
} from '../../src/core/init-generator.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';
import type { MumuSpecConfig } from '../../src/core/config.js';

// ── helpers ────────────────────────────────────────────────────────────────
function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    projectType: 'frontend',
    framework: 'react',
    language: 'typescript',
    hasTypeScript: true,
    hasTests: false,
    hasStorybook: false,
    hasTailwind: false,
    hasCssModules: false,
    hasScss: false,
    hasUiLibrary: false,
    packageName: 'test-proj',
    sourceDirs: ['src'],
    entryPoints: [],
    totalFiles: 0,
    frontendIndicators: [],
    backendIndicators: [],
    ...overrides,
  };
}

function makeConfig(): MumuSpecConfig {
  return {
    version: '1.0.0',
    project: { name: 'test-proj', language: 'typescript' },
    specs: { root: '.mumuspec/specs', format: 'markdown', max_layer_depth: 3, auto_index: true, require_design_doc: true },
    knowledge: {
      enabled: true,
      code_graph: { enabled: false, storage: 'json', db_path: '.mumuspec/graph.json', auto_index_on_commit: false, languages: ['typescript'] },
      wiki: { dir: '.mumuspec/knowledge', auto_extract_on_archive: true, max_pages_per_scope: 50 },
      progressive_disclosure: { max_pages_per_layer: 10, load_stale_summary: true },
      freshness: { check_on_load: true, warn_after_days: 30, error_after_days: 90 },
      drift_detection: true,
      reverse_index: { file: '.mumuspec/knowledge/reverse-index.json', auto_rebuild: [], fallback: true },
      commit_update: { enabled: false, timeout_ms: 5000, async: true, llm_enhancement: false },
    },
  } as unknown as MumuSpecConfig;
}

function makeDetection() {
  return {
    timestamp: '2024-01-01T00:00:00Z',
    os: { type: 'windows' as const, arch: 'x64', version: '10.0' },
    tools: [
      { name: 'node', ecosystem: 'node' as const, version: '20.10.0', location: '/usr/bin/node', envVars: {}, status: 'ok' as const },
    ],
    missing: [],
    warnings: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// generateEnvKnowledgePage
// ═══════════════════════════════════════════════════════════════════════
describe('generateEnvKnowledgePage', () => {
  beforeEach(() => {
    mockWriteText.mockReset();
    mockWriteYaml.mockReset();
    mockEnsureDir.mockReset();
    mockNow.mockReset();
    mockNow.mockReturnValue('2024-01-01 00:00:00');
    mockDetectEnvironment.mockReset();
    mockSaveEnvSpec.mockReset();
    mockDetectRequiredEcosystems.mockReset();
    mockDetectRequiredEcosystems.mockReturnValue([]);
  });

  it('returns null when ecosystems.length <= 1', async () => {
    // Only 'build' detected by default → length 1
    mockDetectRequiredEcosystems.mockReturnValue(['build']);
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).toBeNull();
    expect(mockDetectEnvironment).not.toHaveBeenCalled();
  });

  it('returns null when ecosystems is empty', async () => {
    mockDetectRequiredEcosystems.mockReturnValue([]);
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).toBeNull();
  });

  it('returns null when detectEnvironment throws', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'build']);
    mockDetectEnvironment.mockRejectedValue(new Error('command failed'));
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).toBeNull();
    expect(mockSaveEnvSpec).not.toHaveBeenCalled();
  });

  it('generates env page for node ecosystem', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.filePath.replace(/\\/g, '/')).toBe('knowledge/lessons/KP-ENV-001-environment-setup.md');
    expect(result!.content).toContain('Environment setup: test-proj');
    expect(result!.content).toContain('Node.js 18+ (LTS recommended)');
    expect(result!.content).toContain('npm / pnpm / yarn');
  });

  it('generates env page for python ecosystem', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['python', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Python 3.9+');
    expect(result!.content).toContain('pip or poetry');
  });

  it('generates env page for java ecosystem', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['java', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('JDK 17 or higher');
    expect(result!.content).toContain('Maven 3.8+ or Gradle 7+');
  });

  it('generates env page for go ecosystem', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['go', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Go 1.21+');
  });

  it('generates env page for rust ecosystem (covers lines 185-186)', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['rust', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Rust 1.70+ (rustup)');
  });

  it('excludes missing tools from detected tools table', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'build']);
    mockDetectEnvironment.mockResolvedValue({
      ...makeDetection(),
      tools: [
        { name: 'node', ecosystem: 'node', version: '20.10.0', location: '/usr/bin/node', envVars: {}, status: 'ok' },
        { name: 'python', ecosystem: 'python', version: '', location: '', envVars: {}, status: 'missing' },
      ],
    });
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('| node | 20.10.0 |');
    // python is missing → should NOT appear in the table
    expect(result!.content).not.toContain('| python |');
  });

  it('calls saveEnvSpec after successful detection', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(mockSaveEnvSpec).toHaveBeenCalledTimes(1);
    expect(mockSaveEnvSpec).toHaveBeenCalledWith('/root', expect.objectContaining({ tools: expect.any(Array) }));
  });

  it('uses "project" fallback when packageName is empty', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis({ packageName: '' }));
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Environment setup: project');
  });

  it('includes all ecosystems as tags', async () => {
    mockDetectRequiredEcosystems.mockReturnValue(['node', 'python', 'build']);
    mockDetectEnvironment.mockResolvedValue(makeDetection());
    const result = await generateEnvKnowledgePage('/root', makeConfig(), makeAnalysis());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('  - node');
    expect(result!.content).toContain('  - python');
    expect(result!.content).toContain('  - build');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// scaffoldKnowledgeBase — hasTests branch (lines 232-242)
// ═══════════════════════════════════════════════════════════════════════
describe('scaffoldKnowledgeBase — hasTests branch coverage', () => {
  beforeEach(() => {
    mockWriteText.mockReset();
    mockWriteYaml.mockReset();
    mockEnsureDir.mockReset();
    mockNow.mockReset();
    mockNow.mockReturnValue('2024-01-01 00:00:00');
    mockDetectEnvironment.mockReset();
    mockSaveEnvSpec.mockReset();
    mockDetectRequiredEcosystems.mockReset();
    mockDetectRequiredEcosystems.mockReturnValue([]);
  });

  it('creates testing conventions page when hasTests is true', () => {
    const analysis = makeAnalysis({ hasTests: true });
    const result = scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    // index.yaml + project-type decision + testing pattern + init lesson = 4
    expect(result.created.length).toBe(4);
    const testingPage = result.created.find((p) => p.includes('testing-conventions'));
    expect(testingPage).toBeDefined();
  });

  it('does NOT create testing conventions page when hasTests is false', () => {
    const analysis = makeAnalysis({ hasTests: false });
    const result = scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    // index.yaml + project-type decision + init lesson = 3
    expect(result.created.length).toBe(3);
    const testingPage = result.created.find((p) => p.includes('testing-conventions'));
    expect(testingPage).toBeUndefined();
  });

  it('writes testing page content with correct frontmatter', () => {
    const analysis = makeAnalysis({ hasTests: true });
    const result = scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    // Find the writeText call for the testing conventions page
    const textCalls = mockWriteText.mock.calls;
    const testingCall = textCalls.find((call) => {
      const filePath = call[0] as string;
      return filePath.includes('testing-conventions');
    });
    expect(testingCall).toBeDefined();
    const content = testingCall![1] as string;
    expect(content).toContain('type: pattern');
    expect(content).toContain('Testing conventions and file organization');
    expect(content).toContain('status: confirmed');
  });

  it('creates all required directories', () => {
    scaffoldKnowledgeBase('/root', makeConfig(), makeAnalysis());
    // 5 subdirs: decisions, patterns, risks, rationale, lessons
    const dirPaths = mockEnsureDir.mock.calls.map((c) => c[0] as string);
    expect(dirPaths.some((p) => p.replace(/\\/g, '/').includes('.mumuspec/knowledge/decisions'))).toBe(true);
    expect(dirPaths.some((p) => p.replace(/\\/g, '/').includes('.mumuspec/knowledge/patterns'))).toBe(true);
    expect(dirPaths.some((p) => p.replace(/\\/g, '/').includes('.mumuspec/knowledge/risks'))).toBe(true);
    expect(dirPaths.some((p) => p.replace(/\\/g, '/').includes('.mumuspec/knowledge/rationale'))).toBe(true);
    expect(dirPaths.some((p) => p.replace(/\\/g, '/').includes('.mumuspec/knowledge/lessons'))).toBe(true);
  });

  it('writes _index.yaml with updated page count', () => {
    scaffoldKnowledgeBase('/root', makeConfig(), makeAnalysis({ hasTests: true }));
    const yamlCalls = mockWriteYaml.mock.calls;
    // Second writeYaml call updates the index with page count
    expect(yamlCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = yamlCalls[yamlCalls.length - 1];
    const indexData = lastCall[1] as { stats: { total_pages: number } };
    expect(indexData.stats.total_pages).toBe(3);
  });

  it('handles framework "none" without label', () => {
    const analysis = makeAnalysis({ framework: 'none' });
    const result = scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    expect(result.created.length).toBeGreaterThan(0);
    // Verify writeText was called (content generation works with no framework)
    expect(mockWriteText).toHaveBeenCalled();
  });

  it('includes frontendIndicators in project-type page', () => {
    const analysis = makeAnalysis({ frontendIndicators: ['react', 'vite', 'tailwind'] });
    scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    const textCalls = mockWriteText.mock.calls;
    // First writeText should be the project-type decision page
    const firstContent = textCalls[0][1] as string;
    expect(firstContent).toContain('react');
    expect(firstContent).toContain('vite');
    expect(firstContent).toContain('tailwind');
  });

  it('handles empty frontendIndicators and backendIndicators', () => {
    const analysis = makeAnalysis({
      frontendIndicators: [],
      backendIndicators: [],
    });
    const result = scaffoldKnowledgeBase('/root', makeConfig(), analysis);
    expect(result.created.length).toBeGreaterThan(0);
    const textCalls = mockWriteText.mock.calls;
    const firstContent = textCalls[0][1] as string;
    expect(firstContent).toContain('None detected');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateInitialKnowledgeIndex — deep assertions
// ═══════════════════════════════════════════════════════════════════════
describe('generateInitialKnowledgeIndex — structure', () => {
  it('returns object with version 1 and empty pages', () => {
    const result = generateInitialKnowledgeIndex(makeAnalysis());
    expect(result).toEqual({
      version: 1,
      updated_at: '2024-01-01 00:00:00',
      stats: {
        total_pages: 0,
        by_type: { decision: 0, pattern: 0, risk: 0, rationale: 0, lesson: 0 },
        by_status: { confirmed: 0, stale: 0, superseded: 0, deprecated: 0 },
      },
      pages: [],
    });
  });

  it('uses current timestamp from now()', () => {
    mockNow.mockReturnValue('2025-06-15 12:30:00');
    const result = generateInitialKnowledgeIndex(makeAnalysis());
    expect(result).toHaveProperty('updated_at', '2025-06-15 12:30:00');
    mockNow.mockReturnValue('2024-01-01 00:00:00');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isFrontendProject — edge cases
// ═══════════════════════════════════════════════════════════════════════
describe('isFrontendProject — edge cases', () => {
  it('returns true when projectType is "cli" but frontendIndicators is non-empty', () => {
    const analysis = makeAnalysis({ projectType: 'cli', frontendIndicators: ['react'] });
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('returns true when projectType is "backend" but frontendIndicators is non-empty', () => {
    const analysis = makeAnalysis({ projectType: 'backend', frontendIndicators: ['vite'] });
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('returns true when projectType is "library" but frontendIndicators exist', () => {
    const analysis = makeAnalysis({ projectType: 'library', frontendIndicators: ['svelte'] });
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('returns false for backend with no frontend indicators', () => {
    const analysis = makeAnalysis({ projectType: 'backend', framework: 'express', frontendIndicators: [] });
    expect(isFrontendProject(analysis)).toBe(false);
  });

  it('returns false for cli with no frontend indicators', () => {
    const analysis = makeAnalysis({ projectType: 'cli', framework: 'none', frontendIndicators: [] });
    expect(isFrontendProject(analysis)).toBe(false);
  });

  it('returns true for monorepo with frontend indicators', () => {
    const analysis = makeAnalysis({ projectType: 'monorepo', frontendIndicators: ['nextjs'] });
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('returns true for empty projectType-like case with frontend indicators', () => {
    // Even exotic project types fall back to frontendIndicators check
    const analysis = makeAnalysis({ projectType: 'monorepo', frontendIndicators: ['angular'] });
    expect(isFrontendProject(analysis)).toBe(true);
  });
});
