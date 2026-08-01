/**
 * Project Analyzer — 自动分析项目类型、框架和结构
 *
 * 在 mumuspec init 时调用，结果用于生成初始 spec、design 和知识库。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Project type classification */
export type ProjectType = 'frontend' | 'backend' | 'fullstack' | 'cli' | 'library' | 'monorepo';

/** Supported framework identifiers */
export type Framework =
  | 'react'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'nextjs'
  | 'nuxt'
  | 'express'
  | 'fastify'
  | 'koa'
  | 'nest'
  | 'none';

/** Analysis result */
export interface ProjectAnalysis {
  projectType: ProjectType;
  framework: Framework;
  language: string;
  hasTypeScript: boolean;
  hasTests: boolean;
  hasStorybook: boolean;
  hasTailwind: boolean;
  hasCssModules: boolean;
  hasScss: boolean;
  hasUiLibrary: boolean;
  uiLibrary?: string;
  packageName: string;
  sourceDirs: string[];
  entryPoints: string[];
  totalFiles: number;
  frontendIndicators: string[];
  backendIndicators: string[];
}

/** Detect framework from package.json dependencies */
function detectFramework(pkg: Record<string, unknown>): { framework: Framework; uiLibrary?: string; hasUiLibrary: boolean } {
  const deps = { ...(pkg.dependencies as Record<string, unknown> || {}), ...(pkg.devDependencies as Record<string, unknown> || {}) };
  const depNames = Object.keys(deps);

  // Framework detection (order matters — more specific first)
  if (depNames.includes('next')) return { framework: 'nextjs', hasUiLibrary: false };
  if (depNames.includes('nuxt')) return { framework: 'nuxt', hasUiLibrary: false };
  if (depNames.includes('@angular/core')) return { framework: 'angular', hasUiLibrary: false };
  if (depNames.includes('svelte')) return { framework: 'svelte', hasUiLibrary: false };
  if (depNames.includes('vue')) return { framework: 'vue', hasUiLibrary: false };
  if (depNames.includes('react')) {
    // Detect UI library
    const uiLibs = ['antd', '@mui/material', 'mui', 'chakra-ui', '@chakra-ui/react', 'mantine', '@mantine/core', 'semantic-ui-react', 'react-bootstrap', 'nextui', '@nextui-org/react', 'shadcn-ui', '@radix-ui/react'];
    const detectedUi = uiLibs.find((lib) => depNames.includes(lib));
    return { framework: 'react', uiLibrary: detectedUi, hasUiLibrary: !!detectedUi };
  }
  if (depNames.includes('@nestjs/core')) return { framework: 'nest', hasUiLibrary: false };
  if (depNames.includes('express')) return { framework: 'express', hasUiLibrary: false };
  if (depNames.includes('fastify')) return { framework: 'fastify', hasUiLibrary: false };
  if (depNames.includes('koa')) return { framework: 'koa', hasUiLibrary: false };

  return { framework: 'none', hasUiLibrary: false };
}

/** Detect CSS strategy from dependencies and files */
function detectCssStrategy(pkg: Record<string, unknown>, projectRoot: string): { hasTailwind: boolean; hasScss: boolean; hasCssModules: boolean } {
  const deps = { ...(pkg.dependencies as Record<string, unknown> || {}), ...(pkg.devDependencies as Record<string, unknown> || {}) };
  const depNames = Object.keys(deps);

  const hasTailwind = depNames.includes('tailwindcss');
  const hasScss = depNames.includes('sass') || depNames.includes('node-sass') || existsSync(join(projectRoot, 'src', 'styles')) || existsSync(join(projectRoot, 'src', 'scss'));

  // Check for CSS Modules usage
  const hasCssModules = existsSync(join(projectRoot, 'src')) && dirContainsGlob(join(projectRoot, 'src'), '*.module.css');

  return { hasTailwind, hasScss, hasCssModules };
}

/** Recursive glob check */
function dirContainsGlob(dir: string, pattern: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        if (dirContainsGlob(join(dir, entry.name), pattern)) return true;
      } else if (entry.isFile()) {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          if (regex.test(entry.name)) return true;
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** Find source directories by inspecting root */
function findSourceDirs(projectRoot: string): string[] {
  const candidates = ['src', 'lib', 'app', 'packages', 'demo', 'examples'];
  return candidates.filter((d) => existsSync(join(projectRoot, d)));
}

/** Find entry points */
function findEntryPoints(projectRoot: string, framework: Framework): string[] {
  const entries: string[] = [];
  const candidates: Record<string, string[]> = {
    react: ['src/main.tsx', 'src/index.tsx', 'src/App.tsx', 'src/main.ts', 'index.html'],
    vue: ['src/main.ts', 'src/main.js', 'src/App.vue', 'index.html'],
    angular: ['src/main.ts', 'src/app/app.module.ts'],
    svelte: ['src/main.ts', 'src/App.svelte'],
    nextjs: ['pages/index.tsx', 'app/page.tsx', 'pages/_app.tsx', 'app/layout.tsx'],
    nuxt: ['app.vue', 'nuxt.config.ts'],
    express: ['src/server.ts', 'src/app.ts', 'src/index.js', 'server.js'],
    fastify: ['src/server.ts', 'src/app.ts', 'server.ts'],
    nest: ['src/main.ts', 'src/app.module.ts'],
    none: ['src/index.ts', 'src/main.ts', 'index.js'],
  };
  for (const file of candidates[framework] || candidates.none) {
    if (existsSync(join(projectRoot, file))) entries.push(file);
  }
  return entries;
}

/** Count source files (rough estimate) */
function countSourceFiles(projectRoot: string): number {
  let count = 0;
  const dirs = ['src', 'lib', 'app'];
  for (const dir of dirs) {
    count += countFilesInDir(join(projectRoot, dir));
  }
  return count;
}

function countFilesInDir(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        count += countFilesInDir(join(dir, entry.name));
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|vue|svelte|css|scss)$/.test(entry.name)) {
        count++;
      }
    }
  } catch {
    // ignore
  }
  return count;
}

function dirExists(dir: string): boolean {
  return existsSync(dir);
}

/**
 * Analyze project at given root path
 */
export function analyzeProject(projectRoot: string): ProjectAnalysis {
  const resolvedRoot = resolve(projectRoot);
  const pkgPath = join(resolvedRoot, 'package.json');

  let pkg: Record<string, unknown> = {};
  let packageName = resolvedRoot.split(/[\\/]/).pop() || 'project';

  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      packageName = (pkg.name as string) || packageName;
    } catch {
      // ignore
    }
  }

  const { framework, uiLibrary, hasUiLibrary } = detectFramework(pkg);
  const { hasTailwind, hasScss, hasCssModules } = detectCssStrategy(pkg, resolvedRoot);
  const deps = (pkg.dependencies as Record<string, unknown> | undefined) || {};
  const devDeps = (pkg.devDependencies as Record<string, unknown> | undefined) || {};
  const hasTypeScript = !!devDeps.typescript || !!deps.typescript ||
    existsSync(join(resolvedRoot, 'tsconfig.json'));
  const hasTests = !!devDeps.vitest || !!devDeps.jest || !!devDeps.mocha ||
    dirExists(join(resolvedRoot, 'tests')) || dirExists(join(resolvedRoot, 'test')) ||
    dirExists(join(resolvedRoot, '__tests__'));
  const hasStorybook = dirExists(join(resolvedRoot, '.storybook')) || !!devDeps['@storybook/react'] || !!devDeps['@storybook/vue3'];

  const sourceDirs = findSourceDirs(resolvedRoot);
  const entryPoints = findEntryPoints(resolvedRoot, framework);
  const totalFiles = countSourceFiles(resolvedRoot);

  // Determine project type
  const frontendIndicators: string[] = [];
  const backendIndicators: string[] = [];

  if (['react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt'].includes(framework)) frontendIndicators.push(framework);
  if (existsSync(join(resolvedRoot, 'index.html')) || dirExists(join(resolvedRoot, 'public'))) frontendIndicators.push('static-html');
  if (tailwindIndicators(resolvedRoot)) frontendIndicators.push('tailwind');
  if (hasScss) frontendIndicators.push('scss');
  if (dirContainsGlob(join(resolvedRoot, 'src'), '*.tsx') || dirContainsGlob(join(resolvedRoot, 'src'), '*.jsx')) frontendIndicators.push('jsx-tsx');

  if (['express', 'fastify', 'koa', 'nest'].includes(framework)) backendIndicators.push(framework);
  if (pkg.scripts && (pkg.scripts as Record<string, unknown>).serve) backendIndicators.push('serve-script');
  if (dirExists(join(resolvedRoot, 'src', 'api')) || dirExists(join(resolvedRoot, 'src', 'routes'))) backendIndicators.push('api-routes');

  let projectType: ProjectType = 'library';
  const isFrontend = frontendIndicators.length > 0;
  const isBackend = backendIndicators.length > 0;
  const isCli = !!pkg.bin || (pkg.keywords as string[])?.includes('cli');

  if (isCli && !isFrontend && !isBackend) projectType = 'cli';
  else if (isFrontend && isBackend) projectType = 'fullstack';
  else if (isFrontend) projectType = 'frontend';
  else if (isBackend) projectType = 'backend';
  else if (sourceDirs.includes('packages') || sourceDirs.includes('demo')) projectType = 'monorepo';

  return {
    projectType,
    framework,
    language: hasTypeScript ? 'typescript' : 'javascript',
    hasTypeScript,
    hasTests,
    hasStorybook,
    hasTailwind,
    hasCssModules,
    hasScss,
    hasUiLibrary,
    uiLibrary,
    packageName,
    sourceDirs,
    entryPoints,
    totalFiles,
    frontendIndicators,
    backendIndicators,
  };
}

function tailwindIndicators(root: string): boolean {
  if (existsSync(join(root, 'tailwind.config.js')) || existsSync(join(root, 'tailwind.config.ts'))) return true;
  return false;
}
