/**
 * Init Generator — 基于项目分析的初始化内容生成器
 *
 * 根据 ProjectAnalysis 生成：
 * - 初始 spec.md（基于项目类型和框架）
 * - 初始 design.md（基于项目架构）
 * - 初始知识库（_index.yaml + 基础知识页）
 * - 根目录 DESIGN.md（Google 标准前端设计风格指导，仅前端项目）
 * - 初始 env-spec.md（环境规范，如果项目存在构建工具配置）
 */
import { join } from 'node:path';
import type { ProjectAnalysis, Framework, ProjectType } from './project-analyzer.js';
import { writeText, writeYaml, ensureDir, now } from './utils.js';
import type { MumuSpecConfig } from './config.js';
import { detectEnvironment, saveEnvSpec, detectRequiredEcosystems } from './env-detector.js';

/** 生成结果 */
export interface InitGenerateResult {
  specGenerated: boolean;
  designGenerated: boolean;
  knowledgeGenerated: boolean;
  rootDesignMdGenerated: boolean;
  frontendStyleGuideGenerated: boolean;
}

// ════════════════════════════════════════════════════════════════════
// Spec 生成
// ════════════════════════════════════════════════════════════════════

/** 生成适合项目类型的初始 spec.md */
export function generateInitialSpec(analysis: ProjectAnalysis): string {
  const date = now().split('T')[0];
  const lines: string[] = [];

  lines.push(`---`);
  lines.push(`layer: 0`);
  lines.push(`scope: "."`);
  lines.push(`last_updated: "${date}"`);
  lines.push(`---`);
  lines.push('');

  // Requirement 1: Project Structure (all projects)
  lines.push(`## Requirement: Project Structure Standards`);
  lines.push('');
  lines.push(`### SHALL`);
  lines.push(`- All spec.md files must contain valid frontmatter (layer, scope, last_updated)`);
  lines.push(`- Module exports must go through index.ts (no direct sub-module imports)`);
  lines.push(`- New modules must be registered in .mumuspec/index.yaml`);
  lines.push('');

  lines.push(`### SHALL NOT`);
  lines.push(`- No placeholder text in constraint content`);
  lines.push(`- Must not skip spec validation before build`);
  lines.push('');

  lines.push(`### Enforcement`);
  lines.push(`- STRUCT-1: frontmatter validation (layer is numeric, scope is valid path)`);
  lines.push(`- STRUCT-2: new modules registered in index.yaml children`);
  lines.push('');

  // Requirement 2: Language-Specific
  if (analysis.hasTypeScript) {
    lines.push(`## Requirement: TypeScript Standards`);
    lines.push('');
    lines.push(`### SHALL`);
    lines.push(`- Use strict mode (strict: true in tsconfig.json)`);
    lines.push(`- All public APIs must have explicit type annotations`);
    lines.push(`- Prefer type over interface for simple shapes; interface for contracts`);
    lines.push('');
    lines.push(`### SHALL NOT`);
    lines.push(`- Do not use \`any\` type without documented reason`);
    lines.push(`- Do not bypass type checking with type assertions`);
    lines.push('');
    lines.push(`### Enforcement`);
    lines.push(`- TS-1: strict mode enabled`);
    lines.push(`- TS-2: no undocumented any usage`);
    lines.push('');
  }

  // Requirement 3: Framework-Specific
  const frameworkSpecs = getFrameworkSpec(analysis);
  if (frameworkSpecs) {
    lines.push(frameworkSpecs);
  }

  // Requirement 4: Testing (if detected)
  if (analysis.hasTests) {
    lines.push(`## Requirement: Testing Standards`);
    lines.push('');
    lines.push(`### SHALL`);
    lines.push(`- All public modules must have corresponding unit tests`);
    lines.push(`- Test files follow the pattern: **/*.test.ts or **/*.spec.ts`);
    lines.push(`- Critical paths require integration tests`);
    lines.push('');
    lines.push(`### SHALL NOT`);
    lines.push(`- Do not commit code with failing tests`);
    lines.push(`- Do not skip tests with \`.skip\` without documented reason`);
    lines.push('');
    lines.push(`### Enforcement`);
    lines.push(`- TEST-1: test coverage for public APIs`);
    lines.push(`- TEST-2: no skipped tests without reason`);
    lines.push('');
  }

  // Requirement 5: Error Handling
  lines.push(`## Requirement: Error Handling`);
  lines.push('');
  lines.push(`### SHALL`);
  lines.push(`- All async functions must handle errors explicitly`);
  lines.push(`- User-facing errors must be localized and actionable`);
  lines.push(`- Error codes follow domain-based convention (E-<DOMAIN>-<NUMBER>)`);
  lines.push('');
  lines.push(`### SHALL NOT`);
  lines.push(`- Do not swallow errors silently`);
  lines.push(`- Do not expose internal stack traces to end users`);
  lines.push('');
  lines.push(`### Enforcement`);
  lines.push(`- ERR-1: async error handling coverage`);
  lines.push(`- ERR-2: no empty catch blocks`);
  lines.push('');

  // Requirement 6: Version Management (any change must bump version)
  lines.push(`## Requirement: Version Management`);
  lines.push('');
  lines.push(`### SHALL`);
  lines.push(`- Any code or specification change MUST update package.json version`);
  lines.push(`- src/cli.ts version string must always match package.json version`);
  lines.push(`- Version bumps follow semantic versioning (semver) conventions`);
  lines.push(`- Pre-release suffixes use format: major.minor.patch-<tag>.<number> (e.g., 1.0.0-alpha.0)`);
  lines.push('');
  lines.push(`### SHALL NOT`);
  lines.push(`- Do not commit changes without a version bump`);
  lines.push(`- Do not have mismatched versions between package.json and src/cli.ts`);
  lines.push(`- Do not reuse pre-release numbers (each bump increments)`);
  lines.push('');
  lines.push(`### Enforcement`);
  lines.push(`- VER-1: prebuild-check.mjs validates package.json === src/cli.ts version`);
  lines.push(`- VER-2: pre-commit hook blocks commits with stale version after code change`);
  lines.push('');

  return lines.join('\n');
}

/** 获取框架特定的 spec 内容 */
function getFrameworkSpec(analysis: ProjectAnalysis): string | null {
  const f = analysis.framework;
  if (f === 'none') return null;

  const lines: string[] = [];
  lines.push(`## Requirement: ${getFrameworkLabel(f)} Best Practices`);
  lines.push('');
  lines.push(`### SHALL`);

  switch (f) {
    case 'react':
      lines.push(`- Use functional components with hooks (no class components)`);
      lines.push(`- Separate presentational and container components`);
      lines.push(`- Use React.memo for expensive renders with stable props`);
      if (analysis.hasTailwind) lines.push(`- Use utility-first CSS via Tailwind; avoid custom CSS when possible`);
      if (analysis.hasUiLibrary && analysis.uiLibrary) lines.push(`- Prefer ${analysis.uiLibrary} components over custom implementations`);
      break;
    case 'vue':
      lines.push(`- Use Composition API (script setup) for new components`);
      lines.push(`- Keep components focused and single-responsibility`);
      lines.push(`- Use defineProps/defineEmit with TypeScript generics`);
      break;
    case 'angular':
      lines.push(`- Follow Angular style guide module/folder structure`);
      lines.push(`- Use OnPush change detection strategy where possible`);
      lines.push(`- Implement lazy loading for feature modules`);
      break;
    case 'svelte':
      lines.push(`- Use Svelte 5 runes for reactive state ($state, $derived, $effect)`);
      lines.push(`- Keep component logic minimal; extract to .ts modules`);
      break;
    case 'nextjs':
      lines.push(`- Use App Router for new routes`);
      lines.push(`- Implement streaming and Suspense boundaries for slow data`);
      lines.push(`- Use Server Components by default; Client Components when needed`);
      break;
    case 'nuxt':
      lines.push(`- Use Nuxt 3 composables over manual implementations`);
      lines.push(`- Leverage auto-imports; do not manually import from #imports`);
      break;
    case 'express':
      lines.push(`- Use async/await with proper error propagation to error middleware`);
      lines.push(`- Validate all inputs with a validation library (zod/joi)`);
      lines.push(`- Implement rate limiting on public endpoints`);
      break;
    case 'fastify':
      lines.push(`- Use Fastify schema-based validation for routes`);
      lines.push(`- Leverage Fastify plugins for cross-cutting concerns`);
      break;
    case 'nest':
      lines.push(`- Follow module > controller > service > repository pattern`);
      lines.push(`- Use decorators consistently for cross-cutting concerns`);
      break;
    case 'koa':
      lines.push(`- Use async/await middleware pattern`);
      lines.push(`- Implement proper error handling middleware`);
      break;
  }

  lines.push('');
  lines.push(`### SHALL NOT`);
  switch (f) {
    case 'react':
      lines.push(`- Do not use useState when useReducer is more appropriate for complex state`);
      lines.push(`- Do not create components in render (defeats React.memo)`);
      break;
    case 'vue':
      lines.push(`- Do not mutate props directly`);
      lines.push(`- Do not use watch where computed is sufficient`);
      break;
    default:
      lines.push(`- Do not bypass framework conventions without documentation`);
  }

  lines.push('');
  lines.push(`### Enforcement`);
  lines.push(`- FW-1: framework-specific lint compliance`);
  lines.push('');

  return lines.join('\n');
}

function getFrameworkLabel(f: Framework): string {
  const labels: Record<Framework, string> = {
    react: 'React',
    vue: 'Vue',
    angular: 'Angular',
    svelte: 'Svelte',
    nextjs: 'Next.js',
    nuxt: 'Nuxt',
    express: 'Express',
    fastify: 'Fastify',
    koa: 'Koa',
    nest: 'NestJS',
    none: 'Generic',
  };
  return labels[f] || 'Framework';
}

// ════════════════════════════════════════════════════════════════════
// Design 生成
// ════════════════════════════════════════════════════════════════════

/** 生成初始 design.md */
export function generateInitialDesign(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  lines.push(`# Design: ${analysis.packageName}`);
  lines.push('');
  lines.push(`## Architecture Overview`);
  lines.push('');
  lines.push(generateArchitectureDescription(analysis));
  lines.push('');
  lines.push(`## Key Decisions`);
  lines.push('');
  lines.push(generateKeyDecisions(analysis));
  lines.push('');
  lines.push(`## Module Inventory`);
  lines.push('');
  lines.push(generateModuleInventory(analysis));
  return lines.join('\n');
}

function generateArchitectureDescription(analysis: ProjectAnalysis): string {
  const parts: string[] = [];
  parts.push(`${analysis.packageName} is a ${analysis.projectType} project`);

  if (analysis.framework !== 'none') {
    parts.push(` built with ${getFrameworkLabel(analysis.framework)}`);
  }

  parts.push(`. The project uses ${analysis.language}`);

  if (analysis.hasTypeScript) {
    parts.push(' (strict mode)');
  }

  parts.push('.');

  if (analysis.sourceDirs.length > 0) {
    parts.push(` Source code resides in: ${analysis.sourceDirs.map((d) => `\`${d}/\``).join(', ')}.`);
  }

  if (analysis.entryPoints.length > 0) {
    parts.push(` Entry points: ${analysis.entryPoints.map((e) => `\`${e}\``).join(', ')}.`);
  }

  return parts.join('');
}

function generateKeyDecisions(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  let decisionNum = 1;

  if (analysis.hasTypeScript) {
    lines.push(`### D-${String(decisionNum).padStart(3, '0')}: TypeScript strict mode`);
    lines.push('');
    lines.push(`**Context**: Ensures type safety and catches errors at compile time.`);
    lines.push('');
    lines.push(`**Decision**: Enable strict mode with no implicit any.`);
    lines.push('');
    lines.push(`**Consequence**: Safer refactoring; requires discipline on complex types.`);
    lines.push('');
    decisionNum++;
  }

  if (analysis.framework !== 'none') {
    lines.push(`### D-${String(decisionNum).padStart(3, '0')}: ${getFrameworkLabel(analysis.framework)} as primary framework`);
    lines.push('');
    lines.push(`**Context**: ${getFrameworkLabel(analysis.framework)} provides ${getFrameworkReasoning(analysis.framework)}.`);
    lines.push('');
    lines.push(`**Decision**: Adopt ${getFrameworkLabel(analysis.framework)} as the ${analysis.projectType === 'frontend' ? 'UI' : 'application'} framework.`);
    lines.push('');
    lines.push(`**Consequence**: Ecosystem alignment; easier onboarding.`);
    lines.push('');
    decisionNum++;
  }

  if (analysis.hasTests) {
    lines.push(`### D-${String(decisionNum).padStart(3, '0')}: Testing infrastructure`);
    lines.push('');
    lines.push(`**Context**: Automated testing ensures reliability.`);
    lines.push('');
    lines.push(`**Decision**: Maintain test suite alongside source code.`);
    lines.push('');
    lines.push(`**Consequence**: Slower initial development; faster refactoring.`);
    lines.push('');
  }

  if (analysis.hasTailwind) {
    lines.push(`### D-${String(decisionNum).padStart(3, '0')}: Tailwind CSS for styling`);
    lines.push('');
    lines.push(`**Context**: Utility-first CSS enables rapid UI development.`);
    lines.push('');
    lines.push(`**Decision**: Use Tailwind as the primary styling solution.`);
    lines.push('');
    lines.push(`**Consequence**: Faster prototyping; requires team familiarity.`);
    lines.push('');
  }

  return lines.join('\n');
}

function getFrameworkReasoning(f: Framework): string {
  const reasoning: Record<Framework, string> = {
    react: 'a mature component model and ecosystem',
    vue: 'progressive framework adoption and gentle learning curve',
    angular: 'enterprise-grade conventions and DI container',
    svelte: 'compiler-driven reactivity with minimal runtime',
    nextjs: 'server-side rendering and file-based routing',
    nuxt: 'Vue-based SSR with convention over configuration',
    express: 'minimalist HTTP middleware architecture',
    fastify: 'high-performance HTTP routing with schema validation',
    koa: 'modern async middleware without callback hell',
    nest: 'modular architecture with TypeScript-first design',
    none: 'standard library patterns',
  };
  return reasoning[f] || 'standard patterns';
}

function generateModuleInventory(analysis: ProjectAnalysis): string {
  const lines: string[] = [];
  for (const dir of analysis.sourceDirs) {
    lines.push(`### ${dir}/`);
    lines.push(`- Scope: \`${dir}/\``);
    lines.push(`- Responsibility: ${getDirectoryResponsibility(dir, analysis.projectType)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function getDirectoryResponsibility(dir: string, type: ProjectType): string {
  const map: Record<string, string> = {
    src: 'Primary source code',
    lib: 'Library exports and public API',
    app: 'Application routes and pages',
    packages: 'Monorepo sub-packages',
    demo: 'Demo/example applications',
    examples: 'Usage examples',
  };
  return map[dir] || 'Project code';
}

// ════════════════════════════════════════════════════════════════════
// 知识库初始化
// ════════════════════════════════════════════════════════════════════

/** 生成初始知识库索引 */
export function generateInitialKnowledgeIndex(analysis: ProjectAnalysis): object {
  const date = now();
  return {
    version: 1,
    updated_at: date,
    stats: {
      total_pages: 0,
      by_type: { decision: 0, pattern: 0, risk: 0, rationale: 0, lesson: 0 },
      by_status: { confirmed: 0, stale: 0, superseded: 0, deprecated: 0 },
    } as Record<string, unknown>,
    pages: [] as object[],
  };
}

/** 在初始化时创建知识库目录和基础知识页 */
export function scaffoldKnowledgeBase(
  projectRoot: string,
  config: MumuSpecConfig,
  analysis: ProjectAnalysis,
): { created: string[] } {
  const created: string[] = [];
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);

  // Create directories
  const dirs = ['decisions', 'patterns', 'risks', 'rationale', 'lessons'];
  for (const dir of dirs) {
    ensureDir(join(knowledgeDir, dir));
  }

  // Create index
  const indexPath = join(knowledgeDir, '_index.yaml');
  writeYaml(indexPath, generateInitialKnowledgeIndex(analysis));
  created.push(indexPath);

  // Create initial knowledge pages based on project type
  const pages = getInitialKnowledgePages(analysis);
  for (const page of pages) {
    const filePath = join(knowledgeDir, page.filePath);
    writeText(filePath, page.content);
    created.push(filePath);
  }

  // Update index with created pages
  writeYaml(indexPath, generateKnowledgeIndexFromPages(pages, analysis));

  return { created };
}

/**
 * Generate environment knowledge page from detection results
 * Returns null if no tool ecosystems detected
 */
export async function generateEnvKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  analysis: ProjectAnalysis,
): Promise<{ filePath: string; content: string } | null> {
  // Detect ecosystems based on project files
  const ecosystems = detectRequiredEcosystems(projectRoot);
  if (ecosystems.length <= 1) {
    // Only 'build' detected, skip env-spec generation
    return null;
  }

  // Run environment detection
  let detection;
  try {
    detection = await detectEnvironment({ ecosystems, projectRoot });
  } catch {
    // Detection failed silently - env detection is optional
    return null;
  }

  // Generate env-spec.md
  await saveEnvSpec(projectRoot, detection);

  // Generate knowledge page
  const date = now().split('T')[0];
  const packageLabel = analysis.packageName || 'project';

  const lines: string[] = [];
  lines.push('---');
  lines.push(`id: "KP-ENV-001"`);
  lines.push(`title: "Environment setup: ${packageLabel}"`);
  lines.push('type: lesson');
  lines.push('status: confirmed');
  lines.push('scope: "global"');
  lines.push('tags:');
  lines.push('  - environment');
  lines.push('  - setup');
  for (const eco of ecosystems) {
    lines.push(`  - ${eco}`);
  }
  lines.push(`created_at: "${now()}"`);
  lines.push(`verified_at: "${now()}"`);
  lines.push('freshness: fresh');
  lines.push('---');
  lines.push('');
  lines.push('# Environment Setup');
  lines.push('');
  lines.push('## Detected Tools');
  lines.push('');
  lines.push('| Tool | Version | Location |');
  lines.push('|------|---------|----------|');
  for (const tool of detection.tools) {
    if (tool.status !== 'missing') {
      lines.push(`| ${tool.name} | ${tool.version} | ${tool.location || 'N/A'} |`);
    }
  }
  lines.push('');
  lines.push('## Prerequisites');
  lines.push('');
  for (const eco of ecosystems) {
    switch (eco) {
      case 'java':
        lines.push('- JDK 17 or higher');
        lines.push('- Maven 3.8+ or Gradle 7+');
        break;
      case 'node':
        lines.push('- Node.js 18+ (LTS recommended)');
        lines.push('- npm / pnpm / yarn');
        break;
      case 'python':
        lines.push('- Python 3.9+');
        lines.push('- pip or poetry');
        break;
      case 'go':
        lines.push('- Go 1.21+');
        break;
      case 'rust':
        lines.push('- Rust 1.70+ (rustup)');
        break;
    }
  }
  lines.push('');
  lines.push('## Auto-Generated');
  lines.push('');
  lines.push('This page was auto-generated by `mumuspec env detect` during initialization.');
  lines.push('');
  lines.push('To update: `mumuspec env detect --save`');
  lines.push('');

  const filePath = join('knowledge', 'lessons', 'KP-ENV-001-environment-setup.md');
  const content = lines.join('\n');

  return { filePath, content };
}

interface KnowledgePageDraft {
  id: string;
  title: string;
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson';
  scope: string;
  tags: string[];
  filePath: string;
  content: string;
}

function getInitialKnowledgePages(analysis: ProjectAnalysis): KnowledgePageDraft[] {
  const pages: KnowledgePageDraft[] = [];
  const date = now().split('T')[0];
  let counter = 1;

  // Project type decision
  pages.push({
    id: `KP-${String(counter).padStart(4, '0')}`,
    title: `Project type: ${analysis.projectType} with ${analysis.framework !== 'none' ? getFrameworkLabel(analysis.framework) : 'no framework'}`,
    type: 'decision',
    scope: 'global',
    tags: ['project-type', analysis.projectType, analysis.framework],
    filePath: `decisions/KP-${String(counter).padStart(4, '0')}-project-type-analysis.md`,
    content: `---\nid: "KP-${String(counter).padStart(4, '0')}"\ntitle: "Project type: ${analysis.projectType}"\ntype: decision\nstatus: confirmed\nscope: "global"\ntags:\n${analysis.frontendIndicators.map((t) => `  - ${t}`).join('\n')}\n  - ${analysis.projectType}\ncreated_at: "${now()}"\nverified_at: "${now()}"\nfreshness: fresh\n---\n\n# Project Type Analysis\n\n## Context\n\nProject \`${analysis.packageName}\` was auto-analyzed during \`mumuspec init\`.\n\n## Findings\n\n- **Type**: ${analysis.projectType}\n- **Framework**: ${analysis.framework !== 'none' ? getFrameworkLabel(analysis.framework) : 'None detected'}\n- **Language**: ${analysis.language}\n- **TypeScript**: ${analysis.hasTypeScript ? 'Yes (strict)' : 'No'}\n- **Testing**: ${analysis.hasTests ? 'Yes' : 'No'}\n- **Source directories**: ${analysis.sourceDirs.join(', ') || 'None detected'}\n- **Estimated source files**: ${analysis.totalFiles}\n\n## Frontend Indicators\n\n${analysis.frontendIndicators.length > 0 ? analysis.frontendIndicators.map((i) => `- ${i}`).join('\n') : '- None detected'}\n\n## Backend Indicators\n\n${analysis.backendIndicators.length > 0 ? analysis.backendIndicators.map((i) => `- ${i}`).join('\n') : '- None detected'}\n\n## Consequences\n\nArchitecture and tooling decisions should align with the detected project type.\n`,
  });
  counter++;

  // Testing pattern (if detected)
  if (analysis.hasTests) {
    pages.push({
      id: `KP-${String(counter).padStart(4, '0')}`,
      title: 'Testing conventions and file organization',
      type: 'pattern',
      scope: 'global',
      tags: ['testing', 'conventions', 'file-organization'],
      filePath: `patterns/KP-${String(counter).padStart(4, '0')}-testing-conventions.md`,
      content: `---\nid: "KP-${String(counter).padStart(4, '0')}"\ntitle: "Testing conventions and file organization"\ntype: pattern\nstatus: confirmed\nscope: "global"\ntags:\n  - testing\n  - conventions\n  - file-organization\ncreated_at: "${now()}"\nverified_at: "${now()}"\nfreshness: fresh\n---\n\n# Testing Conventions\n\n## Context\n\nTest infrastructure was detected during project analysis.\n\n## Pattern\n\n- Test files: \`**/*.test.ts\` or \`**/*.spec.ts\`\n- Co-locate tests with source or in dedicated \`tests/\` directory\n- Integration tests for critical paths\n\n## Conventions\n\n1. Unit tests: one test file per source file\n2. Integration tests: under \`tests/integration/\`\n3. Mock external services; test in isolation\n\n## Enforcement\n\n- CI must run tests before merge\n- Coverage reports on PRs\n`,
    });
    counter++;
  }

  // Lesson: init experience
  pages.push({
    id: `KP-${String(counter).padStart(4, '0')}`,
    title: 'Initialization workflow: auto-detect project characteristics',
    type: 'lesson',
    scope: 'global',
    tags: ['init', 'workflow', 'auto-detect'],
    filePath: `lessons/KP-${String(counter).padStart(4, '0')}-init-auto-detect.md`,
    content: `---\nid: "KP-${String(counter).padStart(4, '0')}"\ntitle: "Initialization workflow: auto-detect project characteristics"\ntype: lesson\nstatus: confirmed\nscope: "global"\ntags:\n  - init\n  - workflow\n  - auto-detect\ncreated_at: "${now()}"\nverified_at: "${now()}"\nfreshness: fresh\n---\n\n# Init Auto-Detect Lesson\n\n## Context\n\nWhen running \`mumuspec init\`, the project is analyzed automatically to generate appropriate specs, designs, and knowledge base.\n\n## What Was Learned\n\n1. Detect project type from \`package.json\` dependencies\n2. Identify framework-specific patterns\n3. Generate tailored spec entries (TypeScript, framework best practices, testing)\n4. Create initial design document based on source structure\n5. For frontend projects: generate \`DESIGN.md\` style guide at project root\n\n## Recommendations\n\n- Review generated spec.md after init and customize\n- Update generated design.md after architectural decisions are made\n- Add project-specific knowledge pages as development proceeds\n`,
  });

  return pages;
}

function generateKnowledgeIndexFromPages(
  pages: KnowledgePageDraft[],
  _analysis: ProjectAnalysis,
): object {
  const byType: Record<string, number> = { decision: 0, pattern: 0, risk: 0, rationale: 0, lesson: 0 };
  for (const p of pages) {
    byType[p.type]++;
  }

  return {
    version: 1,
    updated_at: now(),
    stats: {
      total_pages: pages.length,
      by_type: byType,
      by_status: {
        confirmed: pages.length,
        stale: 0,
        superseded: 0,
        deprecated: 0,
      },
    },
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: 'confirmed',
      scope: p.scope,
      file: p.filePath,
      tags: p.tags,
      graph_nodes: [],
      related_specs: [],
      related_contracts: [],
      created_at: now(),
      verified_at: now(),
      freshness: 'fresh',
    })),
  };
}

// ════════════════════════════════════════════════════════════════════
// 前端设计 DESIGN.md（Google 标准）
// ════════════════════════════════════════════════════════════════════

/** 生成 Google 标准前端设计风格指导 DESIGN.md */
export function generateFrontendDesignMd(analysis: ProjectAnalysis): string {
  const framework = getFrameworkLabel(analysis.framework);
  const sections: string[] = [];

  sections.push(`# Design Style Guide: ${analysis.packageName}`);
  sections.push('');
  sections.push('> Auto-generated by MumuSpec during `init`. Based on Google Material Design 3, Web Fundamentals, and Google UX/UI best practices.');
  sections.push('> Customize this file to match your project design requirements.');
  sections.push('');
  sections.push(`> Detected: ${framework} | Language: ${analysis.language} | CSS: ${getCssLabel(analysis)}`);
  sections.push('');

  // 1. Design Principles
  sections.push('## 1. Design Principles');
  sections.push('');
  sections.push('### 1.1 Material Design Principles (adapted)');
  sections.push('');
  sections.push('1. **Meaningful Motion** — Motion should guide attention, provide feedback, and express spatial relationships. Avoid decorative animations.');
  sections.push('2. **Clear Hierarchy** — Use elevation, typography, and spacing to establish clear content hierarchy.');
  sections.push('3. **Bold Intentional** — Typography, color, and layout choices should be deliberate and purposeful.');
  sections.push('4. **Adaptive Design** — Design should work across viewport sizes and input methods.');
  sections.push('');

  // 2. Layout & Grid
  sections.push('## 2. Layout & Grid System');
  sections.push('');
  sections.push('### 2.1 Grid');
  sections.push('');
  sections.push('- **4dp grid system** — All spacing and sizing uses multiples of 4');
  sections.push('- **8dp baseline grid** — Typography uses 8dp vertical rhythm');
  sections.push('- **Responsive breakpoints**:');
  sections.push('  - Mobile: 0–599dp');
  sections.push('  - Tablet: 600–839dp');
  sections.push('  - Desktop: 840dp+');
  sections.push('');

  sections.push('### 2.2 Spacing Scale');
  sections.push('');
  sections.push('| Token | Value | Use |');
  sections.push('|-------|-------|-----|');
  sections.push('| `space-xs` | 4dp | Tight padding, icon spacing |');
  sections.push('| `space-sm` | 8dp | Compact spacing, inline elements |');
  sections.push('| `space-md` | 16dp | Standard padding, card internal |');
  sections.push('| `space-lg` | 24dp | Section separation |');
  sections.push('| `space-xl` | 32dp | Major section breaks |');
  sections.push('| `space-2xl` | 48dp | Page-level separation |');
  sections.push('');

  // 3. Typography
  sections.push('## 3. Typography');
  sections.push('');
  sections.push('### 3.1 Type Scale');
  sections.push('');
  sections.push('| Style | Size | Weight | Line Height | Use |');
  sections.push('|-------|------|--------|-------------|-----|');
  sections.push('| `display-large` | 57px | 400 | 64px | Hero headlines |');
  sections.push('| `display-medium` | 45px | 400 | 52px | Large headings |');
  sections.push('| `display-small` | 36px | 400 | 44px | Page titles |');
  sections.push('| `headline-large` | 32px | 400 | 40px | Section headings |');
  sections.push('| `headline-medium` | 28px | 400 | 36px | Subsection headings |');
  sections.push('| `headline-small` | 24px | 400 | 32px | Component headings |');
  sections.push('| `title-large` | 22px | 500 | 28px | List items, card titles |');
  sections.push('| `title-medium` | 16px | 500 | 24px | Component titles, emphasis |');
  sections.push('| `title-small` | 14px | 500 | 20px | Labels, overlines |');
  sections.push('| `body-large` | 16px | 400 | 24px | Primary body text |');
  sections.push('| `body-medium` | 14px | 400 | 20px | Secondary body text |');
  sections.push('| `body-small` | 12px | 400 | 16px | Captions, helper text |');
  sections.push('| `label-large` | 14px | 500 | 20px | Button labels, input labels |');
  sections.push('| `label-medium` | 12px | 500 | 16px | Input labels, chip text |');
  sections.push('| `label-small` | 11px | 500 | 16px | Tags, timestamps |');
  sections.push('');

  sections.push('### 3.2 Typography Rules');
  sections.push('');
  sections.push('- Use **maximum 2 font families** per project (one for headings, one for body)');
  sections.push('- Minimum readable size: **12sp** for body text, **14sp** for accessibility');
  sections.push('- Line height: 1.4–1.5x for body, 1.2x for headings');
  sections.push('- Maximum line length: **60–80 characters** for readability');
  sections.push('');

  // 4. Color System
  sections.push('## 4. Color System');
  sections.push('');
  sections.push('### 4.1 Color Roles');
  sections.push('');
  sections.push('| Role | Use | Default (Light) |');
  sections.push('|------|-----|-----------------|');
  sections.push('| `primary` | Key interactive elements | #6750A4 |');
  sections.push('| `on-primary` | Text on primary | #FFFFFF |');
  sections.push('| `secondary` | Less prominent actions | #625B71 |');
  sections.push('| `surface` | Cards, sheets, menus | #FEF7FF |');
  sections.push('| `on-surface` | Text on surface | #1D1B20 |');
  sections.push('| `surface-variant` | Distinct surfaces | #E7E0EC |');
  sections.push('| `error` | Error states | #B3261E |');
  sections.push('| `outline` | Borders, dividers | #79747E |');
  sections.push('');

  sections.push('### 4.2 Color Rules');
  sections.push('');
  sections.push('- Maintain **WCAG 2.1 AA contrast** minimum (4.5:1 for text, 3:1 for UI components)');
  sections.push('- Never rely on color alone — always pair with iconography or text');
  sections.push('- Use opacity tokens for hover/focus/disabled states (not separate colors)');
  sections.push('- Dark mode: ensure primary color has sufficient contrast on dark surfaces');
  sections.push('');

  // 5. Components & Patterns
  sections.push('## 5. Components & Patterns');
  sections.push('');
  sections.push('### 5.1 Interactive Components');
  sections.push('');
  sections.push('| Component | Trigger | Behavior |');
  sections.push('|-----------|---------|----------|');
  sections.push('| Button | Click/tap | Execute primary action |');
  sections.push('| Icon button | Click/tap | Secondary action, compact |');
  sections.push('| Link | Click/tap | Navigate, open in new tab if external |');
  sections.push('| Switch | Toggle | Immediate state change |');
  sections.push('| Slider | Drag | Adjust value in range |');
  sections.push('| Selection chip | Toggle | Filter, multi-select |');
  sections.push('| Date picker | Select | Choose single date or range |');
  sections.push('| Tooltip | Hover/focus | Reveal additional info |');
  sections.push('');

  sections.push('### 5.2 Component Rules');
  sections.push('');
  sections.push('- Minimum touch target: **48x48dp**');
  sections.push('- Interactive elements must have focus styles (keyboard)');
  sections.push('- All interactive states: `default`, `hover`, `focused`, `pressed`, `disabled`');
  sections.push('- Loading states for async operations (>300ms)');
  sections.push('');

  // 6. Motion
  sections.push('## 6. Motion & Animation');
  sections.push('');
  sections.push('### 6.1 Duration Standards');
  sections.push('');
  sections.push('| Duration Token | Value | Use |');
  sections.push('|-----------------|-------|-----|');
  sections.push('| `duration-short` | 150ms | Hover, focus transitions |');
  sections.push('| `duration-medium` | 300ms | Element enter/exit |');
  sections.push('| `duration-long` | 500ms | Complex transitions, page transitions |');
  sections.push('');

  sections.push('### 6.2 Easing');
  sections.push('');
  sections.push('| Easing Token | Curve | Use |');
  sections.push('|---------------|-------|-----|');
  sections.push('| `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Standard transitions |');
  sections.push('| `ease-emphasized` | cubic-bezier(0.2, 0, 0, 1) with deceleration | Attention-drawing |');
  sections.push('');

  sections.push('### 6.3 Motion Rules');
  sections.push('');
  sections.push('- **Respect prefers-reduced-motion**: disable non-essential animations');
  sections.push('- Trigger animations on state change, not on page load');
  sections.push('- Stagger delays: 50ms between sequential elements');
  sections.push('- Avoid layout-changing animations (use transform/opacity)');
  sections.push('');

  // 7. Accessibility
  sections.push('## 7. Accessibility Requirements');
  sections.push('');
  sections.push('### 7.1 WCAG 2.1 AA Compliance');
  sections.push('');
  sections.push('- [ ] Color contrast ≥ 4.5:1 (text), ≥ 3:1 (UI components)');
  sections.push('- [ ] All images have descriptive alt text');
  sections.push('- [ ] Form inputs have associated labels');
  sections.push('- [ ] Error messages are descriptive and suggest fixes');
  sections.push('- [ ] Focus indicators visible on all interactive elements');
  sections.push('- [ ] Skip navigation link provided');
  sections.push('');

  sections.push('### 7.2 Keyboard Navigation');
  sections.push('');
  sections.push('- All interactive elements reachable via Tab');
  sections.push('- Enter/Space activates buttons');
  sections.push('- Escape closes modals/menus');
  sections.push('- Arrow keys navigate within components (tabs, menus, lists)');
  sections.push('');

  sections.push('### 7.3 Screen Reader');
  sections.push('');
  sections.push('- Semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<aside>`) ');
  sections.push('- ARIA roles only when semantic HTML insufficient');
  sections.push('- Live regions for dynamic content updates');
  sections.push('');

  // 8. Responsive Design
  sections.push('## 8. Responsive Design');
  sections.push('');
  sections.push('### 8.1 Breakpoints');
  sections.push('');
  sections.push('| Token | Range | Target |');
  sections.push('|-------|-------|--------|');
  sections.push('| `mobile` | 0–599dp | Phones |');
  sections.push('| `tablet` | 600–839dp | Tablets |');
  sections.push('| `desktop` | 840dp+ | Desktop, laptop |');
  sections.push('');

  sections.push('### 8.2 Responsive Rules');
  sections.push('');
  sections.push('- Mobile-first approach (base = mobile, progressive enhancement)');
  sections.push('- Avoid horizontal scrolling on mobile');
  sections.push('- Navigation collapses to bottom bar on mobile (6+ items)');
  tables(sections, analysis);

  // 9. Performance Budget
  sections.push('## 9. Performance Budget');
  sections.push('');
  sections.push('| Metric | Target |');
  sections.push('|--------|--------|');
  sections.push('| LCP (Largest Contentful Paint) | ≤ 2.5s |');
  sections.push('| FID (First Input Delay) | ≤ 100ms |');
  sections.push('| CLS (Cumulative Layout Shift) | ≤ 0.1 |');
  sections.push('| TTI (Time to Interactive) | ≤ 3.5s |');
  sections.push('| Bundle size (initial) | ≤ 200KB gzipped |');
  sections.push('');

  // 10. Code Conventions
  sections.push('## 10. Frontend Code Conventions');
  sections.push('');
  sections.push('### 10.1 Naming');
  sections.push('');
  sections.push('- Components: `PascalCase` (e.g., `UserProfile`)');
  sections.push('- Hooks: `use` prefix (e.g., `useAuthState`)');
  sections.push('- Files: `kebab-case` for components, `camelCase` for modules');
  sections.push('- CSS classes: `kebab-case` or BEM (`.card__title--active`)');
  sections.push('');

  frameworkSpecificSections(sections, analysis);

  return sections.join('\n');
}

function tables(sections: string[], analysis: ProjectAnalysis): void {
  if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
    sections.push('- Tables paginate at 10 rows per page');
  }
  sections.push('- Images: lazy loading below the fold, explicit width/height');
  sections.push('');
}

function frameworkSpecificSections(sections: string[], analysis: ProjectAnalysis): void {
  switch (analysis.framework) {
    case 'react':
      sections.push('### 10.2 React Conventions');
      sections.push('');
      sections.push('- Function components only (no class components)');
      sections.push('- Custom hooks for shared stateful logic');
      sections.push('- Memoization: `React.memo`, `useMemo`, `useCallback` only when measured benefit');
      sections.push('- Error boundaries at route level');
      sections.push('');
      break;
    case 'vue':
      sections.push('### 10.2 Vue Conventions');
      sections.push('');
      sections.push('- Composition API (`<script setup>`) for new components');
      sections.push('- Composables for reusable stateful logic');
      sections.push('- Keep components focused; extract business logic to composables');
      sections.push('');
      break;
    case 'nextjs':
      sections.push('### 10.2 Next.js Conventions');
      sections.push('');
      sections.push('- App Router for new routes');
      sections.push('- Server Components by default');
      sections.push('- `loading.tsx` and `error.tsx` for async boundaries');
      sections.push('');
      break;
  }
}

function getCssLabel(analysis: ProjectAnalysis): string {
  const parts: string[] = [];
  if (analysis.hasTailwind) parts.push('Tailwind');
  if (analysis.hasScss) parts.push('SCSS');
  if (analysis.hasCssModules) parts.push('CSS Modules');
  return parts.join(' + ') || 'Plain CSS';
}

// ════════════════════════════════════════════════════════════════════
// 综合分析入口
// ════════════════════════════════════════════════════════════════════

/** 判断是否为前端项目（需要生成设计指导） */
export function isFrontendProject(analysis: ProjectAnalysis): boolean {
  return analysis.projectType === 'frontend' ||
    analysis.projectType === 'fullstack' ||
    analysis.frontendIndicators.length > 0;
}
