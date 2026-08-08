/**
 * Branch coverage tests for src/core/init-templates.ts
 *
 * Targets uncovered branches:
 * - buildFrameworkSpecLines: all framework cases (angular, svelte, nextjs, nuxt, fastify, koa)
 * - buildFrameworkSpecLines: react with tailwind branch
 * - buildKeyDecisions: framework !== 'none' branch (line 326)
 * - buildKeyDecisions: hasTailwind branch (line 349)
 * - buildArchitectureDescription: framework !== 'none' branch (line 295)
 * - appendTableRules: frontend/fullstack branch (line 604)
 */
import { describe, it, expect } from 'vitest';
import {
  generateInitialSpec,
  buildFrameworkSpecLines,
  generateInitialDesign,
  generateFrontendDesignMd,
} from '../../src/core/init-templates.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
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
// buildFrameworkSpecLines — all framework SHALL branches (lines 196-243)
// ════════════════════════════════════════════════════════════════════

describe('buildFrameworkSpecLines — angular, svelte, nextjs, nuxt, fastify, koa', () => {
  it('should render angular-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'angular' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Angular Best Practices');
    expect(result).toContain('Angular style guide');
    expect(result).toContain('OnPush change detection');
    expect(result).toContain('lazy loading');
  });

  it('should render svelte-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'svelte' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Svelte Best Practices');
    expect(result).toContain('Svelte 5 runes');
    expect(result).toContain('$state, $derived, $effect');
  });

  it('should render nextjs-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'nextjs' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Next.js Best Practices');
    expect(result).toContain('App Router');
    expect(result).toContain('Server Components');
    expect(result).toContain('Suspense boundaries');
  });

  it('should render nuxt-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'nuxt' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Nuxt Best Practices');
    expect(result).toContain('Nuxt 3 composables');
    expect(result).toContain('auto-imports');
  });

  it('should render fastify-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'fastify' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Fastify Best Practices');
    expect(result).toContain('schema-based validation');
    expect(result).toContain('Fastify plugins');
  });

  it('should render koa-specific SHALL guidelines', () => {
    const analysis = makeAnalysis({ framework: 'koa' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('Koa Best Practices');
    expect(result).toContain('async/await middleware');
    expect(result).toContain('error handling middleware');
  });
});

// ════════════════════════════════════════════════════════════════════
// buildFrameworkSpecLines — react with tailwind branch (line 201)
// ════════════════════════════════════════════════════════════════════

describe('buildFrameworkSpecLines — react with tailwind', () => {
  it('should include Tailwind utility-first guidance when hasTailwind is true', () => {
    const analysis = makeAnalysis({
      framework: 'react',
      hasTailwind: true,
    });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).toContain('utility-first CSS via Tailwind');
    expect(result).toContain('avoid custom CSS when possible');
  });

  it('should NOT include Tailwind guidance when hasTailwind is false', () => {
    const analysis = makeAnalysis({
      framework: 'react',
      hasTailwind: false,
    });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).not.toBeNull();
    expect(result).not.toContain('utility-first CSS via Tailwind');
  });

  it('should include UI library specific guidance when hasUiLibrary and uiLibrary set', () => {
    const analysis = makeAnalysis({
      framework: 'react',
      hasUiLibrary: true,
      uiLibrary: 'antd',
    });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('Prefer antd components');
  });
});

// ════════════════════════════════════════════════════════════════════
// buildFrameworkSpecLines — SHALL NOT default branch (line 257)
// ════════════════════════════════════════════════════════════════════

describe('buildFrameworkSpecLines — SHALL NOT default branch', () => {
  it('should render default SHALL NOT for frameworks other than react/vue (angular)', () => {
    const analysis = makeAnalysis({ framework: 'angular' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('SHALL NOT');
    expect(result).toContain('bypass framework conventions without documentation');
  });

  it('should render default SHALL NOT for svelte', () => {
    const analysis = makeAnalysis({ framework: 'svelte' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('bypass framework conventions without documentation');
  });

  it('should render default SHALL NOT for nextjs', () => {
    const analysis = makeAnalysis({ framework: 'nextjs' });
    const result = buildFrameworkSpecLines(analysis);
    expect(result).toContain('bypass framework conventions without documentation');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateInitialDesign — framework !== 'none' branch (lines 295, 326)
// ════════════════════════════════════════════════════════════════════

describe('generateInitialDesign — framework-specific branches', () => {
  it('should include framework label in architecture description when framework is not none', () => {
    const analysis = makeAnalysis({ framework: 'react' });
    const content = generateInitialDesign(analysis);
    expect(content).toContain('React');
    expect(content).toContain('built with');
  });

  it('should include framework decision in Key Decisions when framework is not none', () => {
    const analysis = makeAnalysis({ framework: 'vue' });
    const content = generateInitialDesign(analysis);
    expect(content).toContain('Vue as primary framework');
  });

  it('should NOT include framework decision when framework is none', () => {
    const analysis = makeAnalysis({ framework: 'none' });
    const content = generateInitialDesign(analysis);
    expect(content).not.toContain('as primary framework');
  });

  it('should include Tailwind decision when hasTailwind is true', () => {
    const analysis = makeAnalysis({ framework: 'react', hasTailwind: true });
    const content = generateInitialDesign(analysis);
    expect(content).toContain('Tailwind CSS for styling');
    expect(content).toContain('Utility-first CSS');
  });

  it('should NOT include Tailwind decision when hasTailwind is false', () => {
    const analysis = makeAnalysis({ framework: 'react', hasTailwind: false });
    const content = generateInitialDesign(analysis);
    expect(content).not.toContain('Tailwind CSS for styling');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateFrontendDesignMd — appendTableRules frontend/fullstack branch (line 604)
// ════════════════════════════════════════════════════════════════════

describe('generateFrontendDesignMd — responsive rules branch', () => {
  it('should include table pagination rule for frontend project type', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('Tables paginate at 10 rows per page');
  });

  it('should include table pagination rule for fullstack project type', () => {
    const analysis = makeAnalysis({ projectType: 'fullstack', framework: 'nextjs' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('Tables paginate at 10 rows per page');
  });

  it('should NOT include table pagination rule for backend project type', () => {
    const analysis = makeAnalysis({ projectType: 'backend', framework: 'express' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).not.toContain('Tables paginate at 10 rows per page');
  });

  it('should NOT include table pagination rule for cli project type', () => {
    const analysis = makeAnalysis({ projectType: 'cli', framework: 'none' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).not.toContain('Tables paginate at 10 rows per page');
  });

  it('should always include image lazy loading rule', () => {
    const analysis = makeAnalysis({ projectType: 'backend', framework: 'express' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('lazy loading below the fold');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateFrontendDesignMd — framework-specific sections (lines 612-638)
// ════════════════════════════════════════════════════════════════════

describe('generateFrontendDesignMd — framework-specific sections', () => {
  it('should include React conventions section', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'react' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('### 10.2 React Conventions');
    expect(content).toContain('Function components only');
    expect(content).toContain('React.memo');
  });

  it('should include Vue conventions section', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'vue' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('### 10.2 Vue Conventions');
    expect(content).toContain('Composition API');
    expect(content).toContain('Composables');
  });

  it('should include Next.js conventions section', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'nextjs' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).toContain('### 10.2 Next.js Conventions');
    expect(content).toContain('App Router for new routes');
    expect(content).toContain('Server Components by default');
  });

  it('should NOT include framework-specific section for none framework', () => {
    const analysis = makeAnalysis({ projectType: 'frontend', framework: 'none' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).not.toContain('### 10.2');
  });

  it('should NOT include framework-specific section for express', () => {
    const analysis = makeAnalysis({ projectType: 'backend', framework: 'express' });
    const content = generateFrontendDesignMd(analysis);
    expect(content).not.toContain('### 10.2');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateInitialSpec — framework-specific spec sections via generateInitialSpec
// ════════════════════════════════════════════════════════════════════

describe('generateInitialSpec — framework coverage', () => {
  it('should include Angular Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'angular' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Angular Best Practices');
  });

  it('should include Svelte Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'svelte' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Svelte Best Practices');
  });

  it('should include Next.js Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'nextjs' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Next.js Best Practices');
  });

  it('should include Nuxt Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'nuxt' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Nuxt Best Practices');
  });

  it('should include Fastify Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'fastify' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Fastify Best Practices');
  });

  it('should include Koa Best Practices requirement', () => {
    const analysis = makeAnalysis({ framework: 'koa' });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('## Requirement: Koa Best Practices');
  });

  it('should include react with tailwind guidance in spec', () => {
    const analysis = makeAnalysis({ framework: 'react', hasTailwind: true });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('utility-first CSS via Tailwind');
  });

  it('should include react with UI library guidance in spec', () => {
    const analysis = makeAnalysis({
      framework: 'react',
      hasUiLibrary: true,
      uiLibrary: 'antd',
    });
    const content = generateInitialSpec(analysis);
    expect(content).toContain('Prefer antd components');
  });
});
