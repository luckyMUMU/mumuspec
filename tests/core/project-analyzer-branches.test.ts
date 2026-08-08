/**
 * Branch coverage tests for src/core/project-analyzer.ts
 *
 * Targets uncovered branches:
 * - Framework detection: nextjs, nuxt, angular, svelte, vue, nest, fastify, koa
 * - CSS strategy: tailwind, scss (via sass dep), css modules
 * - Frontend indicators: static-html, tailwind, scss, jsx-tsx
 * - Backend indicators: serve-script, api-routes
 * - Project type: cli, frontend, backend, fullstack, monorepo
 * - Edge cases: missing package.json, invalid JSON, empty dirs
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeProject } from '../../src/core/project-analyzer.js';

/**
 * Helper: create a temp directory with optional package.json and file structure
 */
function createTempProject(opts: {
  pkg?: Record<string, unknown> | null;
  files?: string[];
  dirs?: string[];
}): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'mumuspec-test-'));

  // Always create a .git dir to avoid interfering with parent
  mkdirSync(join(root, '.git'), { recursive: true });

  if (opts.pkg !== null) {
    const pkg = opts.pkg ?? { name: 'test-project', version: '1.0.0' };
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  }

  for (const dir of opts.dirs ?? []) {
    mkdirSync(join(root, dir), { recursive: true });
  }

  for (const file of opts.files ?? []) {
    const fullPath = join(root, file);
    const parent = dirname(fullPath);
    mkdirSync(parent, { recursive: true });
    writeFileSync(fullPath, '// test file\n');
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

// ════════════════════════════════════════════════════════════════════
// Framework detection branches (lines 53-67)
// ════════════════════════════════════════════════════════════════════

describe('framework detection — nextjs, nuxt, angular, svelte, vue', () => {
  it('should detect nextjs from next dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-next-app', dependencies: { next: '^14.0.0', react: '^18.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('nextjs');
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });

  it('should detect nuxt from nuxt dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-nuxt-app', dependencies: { nuxt: '^3.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('nuxt');
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });

  it('should detect angular from @angular/core dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-ng-app', dependencies: { '@angular/core': '^17.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('angular');
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });

  it('should detect svelte from svelte dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-svelte-app', dependencies: { svelte: '^4.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('svelte');
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });

  it('should detect vue from vue dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-vue-app', dependencies: { vue: '^3.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('vue');
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });
});

describe('framework detection — nest, fastify, koa', () => {
  it('should detect nest from @nestjs/core dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-nest-app', dependencies: { '@nestjs/core': '^10.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('nest');
      expect(result.projectType).toBe('backend');
    } finally {
      cleanup();
    }
  });

  it('should detect fastify from fastify dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-fastify-app', dependencies: { fastify: '^4.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('fastify');
      expect(result.projectType).toBe('backend');
    } finally {
      cleanup();
    }
  });

  it('should detect koa from koa dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'my-koa-app', dependencies: { koa: '^2.0.0' } },
    });
    try {
      const result = analyzeProject(root);
      expect(result.framework).toBe('koa');
      expect(result.projectType).toBe('backend');
    } finally {
      cleanup();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// CSS strategy detection branches (lines 77-81)
// ════════════════════════════════════════════════════════════════════

describe('CSS strategy detection', () => {
  it('should detect tailwind from tailwindcss dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'tw-app', devDependencies: { tailwindcss: '^3.0.0' } },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasTailwind).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect scss from sass dependency', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'scss-app', devDependencies: { sass: '^1.0.0' } },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasScss).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect scss from src/styles directory', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'scss-dir-app' },
      dirs: ['src', 'src/styles'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasScss).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect scss from src/scss directory', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'scss-alt-app' },
      dirs: ['src', 'src/scss'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasScss).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect css modules from .module.css file', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'css-modules-app' },
      dirs: ['src'],
      files: ['src/Button.module.css'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasCssModules).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Frontend indicators branches (lines 204-208)
// ════════════════════════════════════════════════════════════════════

describe('frontend indicators', () => {
  it('should add static-html indicator when index.html exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'html-app' },
      dirs: ['src'],
      files: ['index.html'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('static-html');
    } finally {
      cleanup();
    }
  });

  it('should add static-html indicator when public dir exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'public-app' },
      dirs: ['src', 'public'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('static-html');
    } finally {
      cleanup();
    }
  });

  it('should add tailwind indicator when tailwind.config.js exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'tw-config-app' },
      dirs: ['src'],
      files: ['tailwind.config.js'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('tailwind');
    } finally {
      cleanup();
    }
  });

  it('should add tailwind indicator when tailwind.config.ts exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'tw-ts-config-app' },
      dirs: ['src'],
      files: ['tailwind.config.ts'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('tailwind');
    } finally {
      cleanup();
    }
  });

  it('should add scss indicator when hasScss is true', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'scss-ind-app', devDependencies: { sass: '^1.0.0' } },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('scss');
    } finally {
      cleanup();
    }
  });

  it('should add jsx-tsx indicator when .tsx file exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'tsx-app', dependencies: { react: '^18.0.0' } },
      dirs: ['src'],
      files: ['src/App.tsx'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.frontendIndicators).toContain('jsx-tsx');
    } finally {
      cleanup();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Backend indicators branches (lines 210-212)
// ════════════════════════════════════════════════════════════════════

describe('backend indicators', () => {
  it('should add serve-script indicator when scripts.serve exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'serve-app',
        scripts: { serve: 'node dist/server.js' },
        dependencies: { express: '^4.0.0' },
      },
    });
    try {
      const result = analyzeProject(root);
      expect(result.backendIndicators).toContain('serve-script');
    } finally {
      cleanup();
    }
  });

  it('should add api-routes indicator when src/api directory exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'api-app', dependencies: { express: '^4.0.0' } },
      dirs: ['src', 'src/api'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.backendIndicators).toContain('api-routes');
    } finally {
      cleanup();
    }
  });

  it('should add api-routes indicator when src/routes directory exists', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'routes-app', dependencies: { fastify: '^4.0.0' } },
      dirs: ['src', 'src/routes'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.backendIndicators).toContain('api-routes');
    } finally {
      cleanup();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Project type determination (lines 214-223)
// ════════════════════════════════════════════════════════════════════

describe('project type determination', () => {
  it('should classify as cli when pkg.bin exists and no frontend/backend indicators', () => {
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'my-cli',
        bin: './dist/cli.js',
        dependencies: {},
      },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('cli');
    } finally {
      cleanup();
    }
  });

  it('should classify as cli when keywords includes cli', () => {
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'my-cli-tool',
        keywords: ['cli'],
      },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('cli');
    } finally {
      cleanup();
    }
  });

  it('should classify as frontend when only frontend indicators present', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'fe-app', dependencies: { react: '^18.0.0' } },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('frontend');
    } finally {
      cleanup();
    }
  });

  it('should classify as backend when only backend indicators present', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'be-app', dependencies: { express: '^4.0.0' } },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('backend');
    } finally {
      cleanup();
    }
  });

  it('should classify as fullstack when frontend framework + backend api/routes coexist', () => {
    // Note: detectFramework returns the FIRST match (react), so backend indicators
    // must come from pkg.scripts.serve or src/api or src/routes directories
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'fs-app',
        dependencies: { react: '^18.0.0' },
        scripts: { serve: 'node server.js' },
      },
      dirs: ['src', 'src/api'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('fullstack');
    } finally {
      cleanup();
    }
  });

  it('should classify as monorepo when packages dir exists and no frontend/backend', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'mono-app' },
      dirs: ['src', 'packages'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('monorepo');
    } finally {
      cleanup();
    }
  });

  it('should classify as monorepo when demo dir exists and no frontend/backend', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'demo-repo' },
      dirs: ['src', 'demo'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('monorepo');
    } finally {
      cleanup();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Edge cases: missing package.json, invalid JSON, dir handling
// ════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('should handle missing package.json (falls back to dir name)', () => {
    const { root, cleanup } = createTempProject({
      pkg: null,
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.packageName).toBeDefined();
      expect(typeof result.packageName).toBe('string');
      expect(result.framework).toBe('none');
    } finally {
      cleanup();
    }
  });

  it('should handle invalid JSON in package.json gracefully', () => {
    const root = mkdtempSync(join(tmpdir(), 'mumuspec-test-'));
    mkdirSync(join(root, '.git'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{ invalid json !!');

    try {
      const result = analyzeProject(root);
      expect(result).toBeDefined();
      expect(result.framework).toBe('none');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should detect tests from __tests__ directory', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'test-app' },
      dirs: ['src', '__tests__'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasTests).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect storybook from .storybook directory', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'sb-app' },
      dirs: ['src', '.storybook'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasStorybook).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('should detect TypeScript from tsconfig.json', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'ts-app' },
      dirs: ['src'],
      files: ['tsconfig.json'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasTypeScript).toBe(true);
      expect(result.language).toBe('typescript');
    } finally {
      cleanup();
    }
  });

  it('should detect JavaScript when no TypeScript indicators', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'js-app' },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasTypeScript).toBe(false);
      expect(result.language).toBe('javascript');
    } finally {
      cleanup();
    }
  });

  it('should detect react with UI library (mui)', () => {
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'mui-app',
        dependencies: { react: '^18.0.0', '@mui/material': '^5.0.0' },
      },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasUiLibrary).toBe(true);
      expect(result.uiLibrary).toBe('@mui/material');
    } finally {
      cleanup();
    }
  });

  it('should detect react without UI library', () => {
    const { root, cleanup } = createTempProject({
      pkg: {
        name: 'plain-react-app',
        dependencies: { react: '^18.0.0' },
      },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.hasUiLibrary).toBe(false);
      expect(result.uiLibrary).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('should detect entry points for nextjs', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'next-ep-app', dependencies: { next: '^14.0.0', react: '^18.0.0' } },
      dirs: ['pages'],
      files: ['pages/index.tsx'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.entryPoints.length).toBeGreaterThan(0);
      expect(result.entryPoints).toContain('pages/index.tsx');
    } finally {
      cleanup();
    }
  });

  it('should detect entry points for nest', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'nest-ep-app', dependencies: { '@nestjs/core': '^10.0.0' } },
      dirs: ['src'],
      files: ['src/main.ts'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.entryPoints).toContain('src/main.ts');
    } finally {
      cleanup();
    }
  });

  it('should detect entry points for express', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'express-ep-app', dependencies: { express: '^4.0.0' } },
      dirs: ['src'],
      files: ['src/app.ts'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.entryPoints).toContain('src/app.ts');
    } finally {
      cleanup();
    }
  });

  it('should return library type when no indicators present', () => {
    const { root, cleanup } = createTempProject({
      pkg: { name: 'lib-app', dependencies: {} },
      dirs: ['src'],
    });
    try {
      const result = analyzeProject(root);
      expect(result.projectType).toBe('library');
    } finally {
      cleanup();
    }
  });
});
