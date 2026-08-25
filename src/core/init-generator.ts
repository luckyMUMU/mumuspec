/**
 * Init Generator — 基于项目分析的初始化内容生成器
 *
 * 根据 ProjectAnalysis 生成：
 * - 初始 spec.md（基于项目类型和框架）
 * - 初始 design.md（基于项目架构）
 * - 初始知识库（_index.yaml + 基础知识页）
 * - 根目录 DESIGN.md（Google 标准前端设计风格指导，仅前端项目）
 * - 初始 env-spec.md（环境规范，如果项目存在构建工具配置）
 *
 * 注意：spec/design/frontend-design.md 内容生成已提取到 init-templates.ts。
 * 本模块保留：知识库脚手架、环境知识页生成、前端项目判断、统一 re-export。
 */
import { join } from 'node:path';
import type { ProjectAnalysis } from './project-analyzer.js';
import { writeText, writeYaml, ensureDir, now } from './utils.js';
import type { MumuSpecConfig } from './config.js';
import { detectEnvironment, saveEnvSpec, detectRequiredEcosystems } from './env-detector.js';

// ════════════════════════════════════════════════════════════════════
// Re-exports from init-templates (content generators)
// ════════════════════════════════════════════════════════════════════

// Re-export content generators from submodule.
import {
  generateInitialSpec,
  generateInitialDesign,
  generateFrontendDesignMd,
  getFrameworkLabel,
  getFrameworkReasoning,
  buildFrameworkSpecLines,
} from './init-templates.js';

export {
  generateInitialSpec,
  generateInitialDesign,
  generateFrontendDesignMd,
  getFrameworkLabel,
  getFrameworkReasoning,
  buildFrameworkSpecLines,
};

/** 生成结果 */
export interface InitGenerateResult {
  specGenerated: boolean;
  designGenerated: boolean;
  knowledgeGenerated: boolean;
  rootDesignMdGenerated: boolean;
  frontendStyleGuideGenerated: boolean;
}

// ════════════════════════════════════════════════════════════════════
// 知识库初始化
// ════════════════════════════════════════════════════════════════════

/** 生成初始知识库索引 */
export function generateInitialKnowledgeIndex(_analysis: ProjectAnalysis): object {
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

// ════════════════════════════════════════════════════════════════════
// 环境知识页
// ════════════════════════════════════════════════════════════════════

/**
 * Generate environment knowledge page from detection results.
 * Returns null if no tool ecosystems detected.
 */
export async function generateEnvKnowledgePage(
  projectRoot: string,
  _config: MumuSpecConfig,
  analysis: ProjectAnalysis,
): Promise<{ filePath: string; content: string } | null> {
  const ecosystems = detectRequiredEcosystems(projectRoot);
  if (ecosystems.length <= 1) {
    return null;
  }

  let detection;
  try {
    detection = await detectEnvironment({ ecosystems, projectRoot });
  } catch {
    // Detection failed silently - env detection is optional
    return null;
  }

  await saveEnvSpec(projectRoot, detection);

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

// ════════════════════════════════════════════════════════════════════
// 内部 helpers
// ════════════════════════════════════════════════════════════════════

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
  let counter = 1;

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
// 综合分析入口
// ════════════════════════════════════════════════════════════════════

/** 判断是否为前端项目（需要生成设计指导） */
export function isFrontendProject(analysis: ProjectAnalysis): boolean {
  return analysis.projectType === 'frontend' ||
    analysis.projectType === 'fullstack' ||
    analysis.frontendIndicators.length > 0;
}
