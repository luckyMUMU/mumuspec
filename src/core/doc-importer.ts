/**
 * Document & Spec Importer — 初始化时自动导入已有文档和第三方 spec
 *
 * 支持导入：
 * - 项目文档：README.md, CONTRIBUTING.md, docs/*.md, CHANGELOG.md, LICENSE
 * - 第三方 spec：OpenSpec (openspec.config.js, openspec.yaml, .openspec/),
 *                AsyncAPI, OpenAPI/Swagger, GraphQL schema, C4/Structurizr DSL
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { ensureDir, writeText, writeYaml, now } from './utils.js';

/** Supported third-party spec formats */
export type SpecFormat =
  | 'openspec'
  | 'asyncapi'
  | 'openapi'
  | 'graphql'
  | 'c4-model'
  | 'structurizr'
  | 'unknown';

/** Detected document/info source */
export interface DetectedDocument {
  path: string;
  type: 'readme' | 'contributing' | 'changelog' | 'license' | 'docs' | 'third-party-spec';
  content: string;
  title: string;
  summary: string;
}

/** Detected third-party spec */
export interface DetectedSpec {
  format: SpecFormat;
  path: string;
  title: string;
  description: string;
  rawContent: string;
}

/** Import result */
export interface ImportResult {
  documents: DetectedDocument[];
  specs: DetectedSpec[];
  knowledgePageIds: string[];
}

// ════════════════════════════════════════════════════════════════════
// Detection Functions
// ════════════════════════════════════════════════════════════════════

/** Detect and collect all existing project documents */
export function detectExistingDocuments(projectRoot: string): DetectedDocument[] {
  const documents: DetectedDocument[] = [];

  // Top-level markdown files
  const topLevelFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE.md'];
  for (const file of topLevelFiles) {
    const filePath = join(projectRoot, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf8');
    const type = getTopLevelDocType(file);
    const title = extractMarkdownTitle(content) || file;
    const summary = extractFirstParagraph(content) || '';

    documents.push({ path: file, type, content, title, summary });
  }

  // docs/ directory
  const docsDir = join(projectRoot, 'docs');
  if (existsSync(docsDir)) {
    const docFiles = collectMarkdownFiles(docsDir);
    for (const docFile of docFiles) {
      const relativePath = `docs/${docFile.relativePath}`;
      const filePath = join(docsDir, docFile.relativePath);
      const content = readFileSync(filePath, 'utf8');
      const title = extractMarkdownTitle(content) || basename(docFile.relativePath, '.md');
      const summary = extractFirstParagraph(content) || '';

      documents.push({
        path: relativePath,
        type: 'docs',
        content,
        title,
        summary,
      });
    }
  }

  // doc/ directory (alternative)
  const docAltDir = join(projectRoot, 'doc');
  if (existsSync(docAltDir)) {
    const docFiles = collectMarkdownFiles(docAltDir);
    for (const docFile of docFiles) {
      const relativePath = `doc/${docFile.relativePath}`;
      const filePath = join(docAltDir, docFile.relativePath);
      const content = readFileSync(filePath, 'utf8');
      const title = extractMarkdownTitle(content) || basename(docFile.relativePath, '.md');
      const summary = extractFirstParagraph(content) || '';

      documents.push({
        path: relativePath,
        type: 'docs',
        content,
        title,
        summary,
      });
    }
  }

  return documents;
}

/** Detect third-party spec files in the project */
export function detectThirdPartySpecs(projectRoot: string): DetectedSpec[] {
  const specs: DetectedSpec[] = [];

  // OpenSpec detection
  const openspecFiles = [
    'openspec.config.js',
    'openspec.config.json',
    'openspec.yaml',
    'openspec.yml',
    '.openspec/spec.yaml',
    '.openspec/spec.yml',
    '/openspec.yaml',
    '/openspec.yml',
  ];
  for (const file of openspecFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf8');
        specs.push({
          format: 'openspec',
          path: file,
          title: 'OpenSpec Specification',
          description: 'OpenSpec change-driven specification',
          rawContent: content,
        });
      } catch {
        // ignore
      }
    }
  }

  // Also check .openspec/ directory
  const openspecDir = join(projectRoot, '.openspec');
  if (existsSync(openspecDir)) {
    try {
      const entries = readdirSync(openspecDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name.endsWith('.md')) {
          const filePath = join(openspecDir, entry.name);
          const content = readFileSync(filePath, 'utf8');
          if (!specs.find((s) => s.format === 'openspec' && s.path.includes('.openspec/'))) {
            specs.push({
              format: 'openspec',
              path: `.openspec/${entry.name}`,
              title: 'OpenSpec Specification',
              description: 'OpenSpec change-driven specification',
              rawContent: content,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // AsyncAPI detection
  const asyncapiFiles = ['asyncapi.yaml', 'asyncapi.yml', 'asyncapi.json'];
  for (const file of asyncapiFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      specs.push({
        format: 'asyncapi',
        path: file,
        title: 'AsyncAPI Specification',
        description: 'Async event-driven API specification',
        rawContent: content,
      });
    }
  }

  // OpenAPI/Swagger detection
  const openapiFiles = [
    'openapi.yaml', 'openapi.yml', 'openapi.json',
    'swagger.yaml', 'swagger.yml', 'swagger.json',
    'api-spec.yaml', 'api-spec.yml', 'api-spec.json',
  ];
  for (const file of openapiFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      specs.push({
        format: 'openapi',
        path: file,
        title: 'OpenAPI/Swagger Specification',
        description: 'REST API specification',
        rawContent: content,
      });
    }
  }

  // GraphQL schema detection
  const graphqlFiles = ['schema.graphql', 'schema.gql', 'graphql/schema.graphql'];
  for (const file of graphqlFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      specs.push({
        format: 'graphql',
        path: file,
        title: 'GraphQL Schema',
        description: 'GraphQL type definitions',
        rawContent: content,
      });
    }
  }

  // C4 / Structurizr DSL
  const c4Files = ['model.dsl', 'workspace.dsl', 'c4.dsl', 'structurizr.dsl'];
  for (const file of c4Files) {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      specs.push({
        format: 'c4-model',
        path: file,
        title: 'C4 Model (Structurizr DSL)',
        description: 'Software architecture model',
        rawContent: content,
      });
    }
  }

  return specs;
}

// ════════════════════════════════════════════════════════════════════
// Import Functions
// ════════════════════════════════════════════════════════════════════

/** Import existing documents into knowledge base as reference pages */
export function importExistingDocuments(
  projectRoot: string,
  config: { knowledge: { wiki: { dir: string } } },
  documents: DetectedDocument[],
): string[] {
  const createdFiles: string[] = [];
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);
  const importsDir = join(knowledgeDir, 'imports');

  ensureDir(importsDir);

  for (const doc of documents) {
    const safeName = doc.path.replace(/[\/\\]/g, '_').replace(/\.md$/, '').toLowerCase();
    const targetPath = join(importsDir, `${safeName}.md`);

    const content = `---
id: "IMPORT-${safeName.toUpperCase()}"
title: "${doc.title}"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - ${doc.type}
source: "${doc.path}"
created_at: "${now()}"
verified_at: "${now()}"
freshness: fresh
---

# ${doc.title}

> **Source**: \`${doc.path}\` | **Type**: ${doc.type} | **Imported**: ${now().split('T')[0]}

## Summary

${doc.summary || '_No summary extracted._'}

## Original Content

${doc.content}
`;

    writeText(targetPath, content);
    createdFiles.push(targetPath);
  }

  return createdFiles;
}

/** Convert third-party specs into MumuSpec knowledge entries */
export function importThirdPartySpecs(
  projectRoot: string,
  config: { knowledge: { wiki: { dir: string } } },
  specs: DetectedSpec[],
): string[] {
  const createdFiles: string[] = [];
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);
  const specsDir = join(knowledgeDir, 'external-specs');

  ensureDir(specsDir);

  for (const spec of specs) {
    const safeName = `${spec.format}-${spec.path.replace(/[\/\\]/g, '_').replace(/\.(yaml|yml|json|js|graphql|gql|dsl)$/, '')}`;
    const targetPath = join(specsDir, `${safeName}.imported.md`);

    const knowledgePage = `---
id: "SPEC-${spec.format.toUpperCase()}-${safeName.slice(-8).toUpperCase()}"
title: "${spec.title}"
type: pattern
status: confirmed
scope: "external-spec"
tags:
  - external-spec
  - ${spec.format}
  - imported
source: "${spec.path}"
created_at: "${now()}"
verified_at: "${now()}"
freshness: fresh
---

# ${spec.title}

> **Source**: \`${spec.path}\` | **Format**: ${spec.format} | **Imported**: ${now().split('T')[0]}

## Description

${spec.description}

## MumuSpec Integration Notes

This specification was detected during init and imported as reference knowledge.

- Use \`mumuspec context\` to correlate specs with code
- Use \`mumuspec drift\` to detect mismatches between spec and implementation
- Update this page when the source spec changes

## Source Content

\`\`\`
${spec.rawContent.substring(0, 8000)}${spec.rawContent.length > 8000 ? '\n... (truncated)' : ''}
\`\`_
`;

    writeText(targetPath, knowledgePage);
    createdFiles.push(targetPath);
  }

  return createdFiles;
}

/** Generate an index file for all imported resources */
export function generateImportIndex(
  projectRoot: string,
  config: { knowledge: { wiki: { dir: string } } },
  documents: DetectedDocument[],
  specs: DetectedSpec[],
): void {
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);
  const indexPath = join(knowledgeDir, 'imports', '_import-index.yaml');

  writeYaml(indexPath, {
    version: 1,
    generated_at: now(),
    documents: documents.map((doc) => ({
      source: doc.path,
      title: doc.title,
      type: doc.type,
    })),
    specs: specs.map((spec) => ({
      source: spec.path,
      format: spec.format,
      title: spec.title,
    })),
  });
}

// ════════════════════════════════════════════════════════════════════
// Helper Functions
// ════════════════════════════════════════════════════════════════════

function getTopLevelDocType(filename: string): 'readme' | 'contributing' | 'changelog' | 'license' {
  switch (filename.toLowerCase()) {
    case 'readme.md': return 'readme';
    case 'contributing.md': return 'contributing';
    case 'changelog.md': return 'changelog';
    case 'license':
    case 'license.md': return 'license';
    default: return 'readme';
  }
}

function extractMarkdownTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractFirstParagraph(content: string): string | undefined {
  // Skip the title and get first meaningful paragraph
  const lines = content.split('\n');
  let pastTitle = false;
  const paragraphLines: string[] = [];

  for (const line of lines) {
    if (!pastTitle) {
      if (line.startsWith('# ')) {
        pastTitle = true;
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('---')) {
      if (paragraphLines.length > 0) break;
      continue;
    }
    if (trimmed.startsWith('-') || trimmed.startsWith('|') || trimmed.startsWith('```')) continue;
    paragraphLines.push(trimmed);
    if (paragraphLines.length >= 3) break;
  }

  return paragraphLines.length > 0 ? paragraphLines.join(' ').substring(0, 200) : undefined;
}

interface DocFileInfo {
  relativePath: string;
}

function collectMarkdownFiles(dir: string, prefix = ''): DocFileInfo[] {
  const results: DocFileInfo[] = [];
  if (!existsSync(dir)) return results;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...collectMarkdownFiles(join(dir, entry.name), `${prefix}${entry.name}/`));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push({ relativePath: `${prefix}${entry.name}` });
      }
    }
  } catch {
    // ignore
  }

  return results;
}
