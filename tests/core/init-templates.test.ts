/**
 * Tests for src/core/init-templates.ts — template rendering functions for init.
 *
 * The user calls this file "spec-templater" — it contains the template rendering
 * logic used during `mumuspec init` to generate spec.md / design.md content.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFrameworkLabel,
  getFrameworkReasoning,
  generateInitialSpec,
  buildFrameworkSpecLines,
  generateInitialDesign,
  generateFrontendDesignMd,
} from '../../src/core/init-templates.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

// ════════════════════════════════════════════════════════════════════
// Helpers — ProjectAnalysis factory
// ════════════════════════════════════════════════════════════════════

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    projectType: 'cli',
    framework: 'none',
    language: 'typescript',
    hasTypeScript: true,
    hasTests: false,
    hasStorybook: false,
    hasTailwind: false,
    hasCssModules: false,
    hasScss: false,
    hasUiLibrary: false,
    packageName: 'test-project',
    sourceDirs: ['src'],
    entryPoints: ['src/cli.ts'],
    totalFiles: 50,
    frontendIndicators: [],
    backendIndicators: [],
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// getFrameworkLabel — input/output
// ════════════════════════════════════════════════════════════════════

describe('getFrameworkLabel', () => {
  it('should return correct label for each framework', () => {
    expect(getFrameworkLabel('react')).toBe('React');
    expect(getFrameworkLabel('vue')).toBe('Vue');
    expect(getFrameworkLabel('angular')).toBe('Angular');
    expect(getFrameworkLabel('svelte')).toBe('Svelte');
    expect(getFrameworkLabel('nextjs')).toBe('Next.js');
    expect(getFrameworkLabel('nuxt')).toBe('Nuxt');
    expect(getFrameworkLabel('express')).toBe('Express');
    expect(getFrameworkLabel('fastify')).toBe('Fastify');
    expect(getFrameworkLabel('koa')).toBe('Koa');
    expect(getFrameworkLabel('nest')).toBe('NestJS');
    expect(getFrameworkLabel('none')).toBe('Generic');
  });

  it('should handle boundary case: empty string falls through to "Framework"', () => {
    // @ts-expect-error — testing robustness against invalid input
    expect(getFrameworkLabel('')).toBe('Framework');
  });

  it('should return "Framework" for unknown/unexpected framework', () => {
    // @ts-expect-error — testing robustness against invalid input
    expect(getFrameworkLabel('solidjs')).toBe('Framework');
  });
});

// ════════════════════════════════════════════════════════════════════
// getFrameworkReasoning — variable interpolation correctness
// ════════════════════════════════════════════════════════════════════

describe('getFrameworkReasoning', () => {
  it('should return descriptive reasoning for known frameworks', () => {
    expect(getFrameworkReasoning('react')).toContain('component model');
    expect(getFrameworkReasoning('vue')).toContain('progressive');
    expect(getFrameworkReasoning('angular')).toContain('enterprise');
    expect(getFrameworkReasoning('svelte')).toContain('compiler');
    expect(getFrameworkReasoning('nextjs')).toContain('server-side');
    expect(getFrameworkReasoning('nuxt')).toContain('SSR');
    expect(getFrameworkReasoning('express')).toContain('middleware');
    expect(getFrameworkReasoning('fastify')).toContain('performance');
    expect(getFrameworkReasoning('nest')).toContain('modular');
    expect(getFrameworkReasoning('none')).toContain('standard');
  });

  it('should return standard patterns for unknown framework', () => {
    // @ts-expect-error — testing fallback
    expect(getFrameworkReasoning('ember')).toBe('standard patterns');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateInitialSpec — content structure
// ════════════════════════════════════════════════════════════════════

describe('generateInitialSpec', () => {
  it('should produce valid markdown with frontmatter', () => {
    const analysis = makeAnalysis();
    const content = generateInitialSpec(analysis);

    expect(content).toContain('layer: 0');
    expect(content).toContain('scope: "."');
    expect(content).toMatch(/last_updated: "\d{4}-\d{2}-\d{2}"/);
  });

  it('should include TypeScript requirements when hasTypeScript is true', () => {
    const analysis = makeAnalysis({ hasTypeScript: true });
    const content = generateInitialSpec(analysis);

    expect(content).toContain('## Requirement: TypeScript Standards');
    expect(content).toContain('strict mode');
    expect(content).toContain('TS-1');
    expect(content).toContain('TS-2');
  });

  it('should omit TypeScript section when hasTypeScript is false', () => {
    const analysis = makeAnalysis({ hasTypeScript: false });
    const content = generateInitialSpec(analysis);

    expect(content).not.toContain('## Requirement: TypeScript Standards');
  });

  it('should include testing section when hasTests is true', () => {
    const analysis = makeAnalysis({ hasTests: true });
    const content = generateInitialSpec(analysis);

    expect(content).toContain('## Requirement: Testing Standards');
    expect(content).toContain('TEST-1');
  });

  it('should omit testing section when hasTests is false', () => {
    const analysis = makeAnalysis({ hasTests: false });
    const content = generateInitialSpec(analysis);

    expect(content).not.toContain('## Requirement: Testing Standards');
  });

  it('should include framework-specific block for react', () => {
    const analysis = makeAnalysis({ framework: 'react' });
    const content = generateInitialSpec(analysis);

    expect(content).toContain('## Requirement: React Best Practices');
    expect(content).toContain('functional components');
    expect(content).toContain('React.memo');
  });

  it('should include framework-specific block for express', () => {
    const analysis = makeAnalysis({ framework: 'express' });
    const content = generateInitialSpec(analysis);

    expect(content).toContain('## Requirement: Express Best Practices');
    expect(content).toContain('async/await');
    expect(content).toContain('rate limiting');
  });

  it('should always include Error Handling and Version Management requirements', () => {
    const analysis = makeAnalysis();
    const content = generateInitialSpec(analysis);

    expect(content).toContain('## Requirement: Error Handling');
    expect(content).toContain('E-<DOMAIN>-<NUMBER>');
    expect(content).toContain('## Requirement: Version Management');
    expect(content).toContain('semver');
  });

  it('should include multiple requirements when all flags are set', () => {
    const analysis = makeAnalysis({
      hasTypeScript: true,
      hasTests: true,
      framework: 'react',
    });
    const content = generateInitialSpec(analysis);

    // At least: Project Structure + TypeScript + React + Testing + Error Handling + Version Management
    const reqCount = (content.match(/## Requirement:/g) || []).length;
    expect(reqCount).toBeGreaterThanOrEqual(5);
  });

  it('should handle project with no framework (generic output)', () => {
    const analysis = makeAnalysis({ framework: 'none' });
    const content = generateInitialSpec(analysis);

    expect(content).not.toContain('## Requirement: none Best Practices');
    // Should still have Project Structure, Error Handling, and Version Management
    expect(content).toContain('## Requirement: Project Structure Standards');
    expect(content).toContain('## Requirement: Error Handling');
  });
});

// ════════════════════════════════════════════════════════════════════
// buildFrameworkSpecLines — template rendering per-framework
// ════════════════════════════════════════════════════════════════════

describe('buildFrameworkSpecLines', () => {
  it('should return null for framework "none"', () => {
    const analysis = makeAnalysis({ framework: 'none' });
    expect(buildFrameworkSpecLines(analysis)).toBeNull();
  });

  it('should produce non-null string for react framework', () => {
    const analysis = makeAnalysis({ framework: 'react' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('React Best Practices');
    expect(result).toContain('SHALL');
    expect(result).toContain('SHALL NOT');
    expect(result).toContain('FW-1');
  });

  it('should include UI library mention when hasUiLibrary is true', () => {
    const analysis = makeAnalysis({
      framework: 'react',
      hasUiLibrary: true,
      uiLibrary: 'antd',
    });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('antd');
  });

  it('should render Vue framework conventions', () => {
    const analysis = makeAnalysis({ framework: 'vue' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('Composition API');
    expect(result).toContain('defineProps');
  });

  it('should render NestJS framework conventions', () => {
    const analysis = makeAnalysis({ framework: 'nest' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('module > controller > service > repository');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateInitialDesign — design.md output
// ════════════════════════════════════════════════════════════════════

describe('generateInitialDesign', () => {
  it('should include title with package name', () => {
    const analysis = makeAnalysis({ packageName: 'my-awesome-cli' });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('# Design: my-awesome-cli');
  });

  it('should include Architecture Overview section', () => {
    const analysis = makeAnalysis();
    const content = generateInitialDesign(analysis);

    expect(content).toContain('## Architecture Overview');
    expect(content).toContain('cli project');
  });

  it('should include TypeScript strict mode mention for TS projects', () => {
    const analysis = makeAnalysis({ hasTypeScript: true });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('strict mode');
  });

  it('should include Key Decisions with D-001 numbering', () => {
    const analysis = makeAnalysis({ hasTypeScript: true });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('## Key Decisions');
    expect(content).toContain('D-001');
  });

  it('should include testing decision when hasTests is true', () => {
    const analysis = makeAnalysis({ hasTests: true });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('D-');
    expect(content).toContain('Testing infrastructure');
  });

  it('should list source directories in Module Inventory', () => {
    const analysis = makeAnalysis({ sourceDirs: ['src', 'tests', 'demo'] });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('## Module Inventory');
    expect(content).toContain('### src/');
    expect(content).toContain('### tests/');
    expect(content).toContain('### demo/');
  });

  it('should include entry point references in architecture description', () => {
    const analysis = makeAnalysis({ entryPoints: ['src/cli.ts', 'src/mcp-server.ts'] });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('src/cli.ts');
    expect(content).toContain('src/mcp-server.ts');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateFrontendDesignMd — Google style guide output
// ════════════════════════════════════════════════════════════════════

describe('generateFrontendDesignMd', () => {
  it('should produce non-empty string output', () => {
    const analysis = makeAnalysis({
      projectType: 'frontend',
      framework: 'react',
      hasTailwind: true,
      hasUiLibrary: true,
      uiLibrary: 'antd',
    });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(100);
  });

  it('should include all 10 numbered sections', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('## 1. Design Principles');
    expect(content).toContain('## 2. Layout & Grid System');
    expect(content).toContain('## 3. Typography');
    expect(content).toContain('## 4. Color System');
    expect(content).toContain('## 5. Components & Patterns');
    expect(content).toContain('## 6. Motion & Animation');
    expect(content).toContain('## 7. Accessibility Requirements');
    expect(content).toContain('## 8. Responsive Design');
    expect(content).toContain('## 9. Performance Budget');
    expect(content).toContain('## 10. Frontend Code Conventions');
  });

  it('should include framework-specific conventions for React', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('React Conventions');
    expect(content).toContain('Function components only');
  });

  it('should include framework-specific conventions for Vue', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'vue' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('Vue Conventions');
    expect(content).toContain('Composables');
  });

  it('should include framework-specific conventions for Next.js', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'nextjs' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('Next.js Conventions');
    expect(content).toContain('App Router');
  });

  it('should detect Tailwind in CSS label', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', hasTailwind: true });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('Tailwind');
  });

  it('should include CSS Modules in CSS label when detected', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', hasCssModules: true });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('CSS Modules');
  });

  it('should handle "none" framework without framework-specific conventions', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'none' });
    const content = generateFrontendDesignMd(analysis);

    // Should not have any framework-specific section (10.2)
    expect(content).not.toContain('### 10.2');
  });

  it('should include responsive breakpoint table', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('| `mobile` | 0–599dp |');
    expect(content).toContain('| `tablet` | 600–839dp |');
    expect(content).toContain('| `desktop` | 840dp+ |');
  });

  it('should include WCAG aria checkboxes', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('WCAG 2.1 AA Compliance');
    expect(content).toContain('Color contrast');
    expect(content).toContain('Semantic HTML');
  });
});

// ════════════════════════════════════════════════════════════════════
// Boundary / edge cases
// ════════════════════════════════════════════════════════════════════

describe('boundary cases', () => {
  it('should handle empty sourceDirs without crashing', () => {
    const analysis = makeAnalysis({ sourceDirs: [] });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('## Module Inventory');
    // No module entries
    expect(content).not.toContain('### src/');
  });

  it('should handle empty entryPoints without crashing', () => {
    const analysis = makeAnalysis({ entryPoints: [] });
    const content = generateInitialDesign(analysis);

    expect(content).toContain('## Architecture Overview');
  });

  it('should handle monorepo project type', () => {
    const analysis = makeAnalysis({
      projectType: 'monorepo',
      sourceDirs: ['packages/core', 'packages/cli'],
    });
    const content = generateInitialSpec(analysis);

    expect(content).toContain('Project Structure');
  });

  it('should handle all CSS methods combined', () => {
    const analysis = makeAnalysis({
      projectType: 'frontend',
      hasTailwind: true,
      hasScss: true,
      hasCssModules: true,
    });
    const content = generateFrontendDesignMd(analysis);

    expect(content).toContain('Tailwind');
    expect(content).toContain('SCSS');
    expect(content).toContain('CSS Modules');
  });
});
