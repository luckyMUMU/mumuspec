/**
 * Tests for src/core/init-generator.ts — generateInitialKnowledgeIndex, scaffoldKnowledgeBase, isFrontendProject.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteText = vi.fn();
const mockWriteYaml = vi.fn();
const mockEnsureDir = vi.fn();
const mockNow = vi.fn(() => '2024-01-01 00:00:00');
const mockDetectEnvironment = vi.fn();
const mockSaveEnvSpec = vi.fn();

vi.mock('../../src/core/utils.js', () => ({
  writeText: (...args: unknown[]) => mockWriteText(...args),
  writeYaml: (...args: unknown[]) => mockWriteYaml(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  now: () => mockNow(),
}));

vi.mock('../../src/core/env-detector.js', () => ({
  detectEnvironment: (...args: unknown[]) => mockDetectEnvironment(...args),
  saveEnvSpec: (...args: unknown[]) => mockSaveEnvSpec(...args),
  detectRequiredEcosystems: vi.fn(() => []),
}));

import {
  generateInitialKnowledgeIndex,
  scaffoldKnowledgeBase,
  isFrontendProject,
} from '../../src/core/init-generator.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

describe('generateInitialKnowledgeIndex', () => {
  it('should return a valid index object', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'frontend', framework: 'react', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'test', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    const result = generateInitialKnowledgeIndex(analysis);
    expect(result).toBeDefined();
  });

  it('should respect the analysis argument', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'backend', framework: 'express', language: 'javascript',
      hasTypeScript: false, hasTests: true, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'backend-proj', sourceDirs: ['src'],
      entryPoints: ['index.js'], totalFiles: 5, frontendIndicators: [], backendIndicators: ['express'],
    };
    const result = generateInitialKnowledgeIndex(analysis);
    expect(typeof result).toBe('object');
  });
});

describe('scaffoldKnowledgeBase', () => {
  beforeEach(() => {
    mockWriteText.mockReset();
    mockWriteYaml.mockReset();
    mockEnsureDir.mockReset();
  });

  it('should write index.yaml and base files', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'frontend', framework: 'vue', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'vue-proj', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    scaffoldKnowledgeBase('/root', analysis);
    expect(mockEnsureDir).toHaveBeenCalled();
    expect(mockWriteYaml).toHaveBeenCalled();
  });

  it('should call writeText for each generated page', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'cli', framework: 'none', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'cli-tool', sourceDirs: ['src'],
      entryPoints: ['cli.ts'], totalFiles: 3, frontendIndicators: [], backendIndicators: [],
    };
    scaffoldKnowledgeBase('/root', analysis);
    expect(mockWriteText).toHaveBeenCalled();
  });
});

describe('isFrontendProject', () => {
  it('should return true for frontend project type', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'frontend', framework: 'react', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'fe-proj', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('should return true for fullstack project type', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'fullstack', framework: 'nextjs', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'fs-proj', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    expect(isFrontendProject(analysis)).toBe(true);
  });

  it('should return false for backend project type', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'backend', framework: 'express', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'be-proj', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    expect(isFrontendProject(analysis)).toBe(false);
  });

  it('should return false for cli project type', () => {
    const analysis: ProjectAnalysis = {
      projectType: 'cli', framework: 'none', language: 'typescript',
      hasTypeScript: true, hasTests: false, hasStorybook: false,
      hasTailwind: false, hasCssModules: false, hasScss: false,
      hasUiLibrary: false, packageName: 'cli-app', sourceDirs: ['src'],
      entryPoints: [], totalFiles: 0, frontendIndicators: [], backendIndicators: [],
    };
    expect(isFrontendProject(analysis)).toBe(false);
  });
});
