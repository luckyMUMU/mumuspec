/**
 * CHG-4 — 术语漂移扫描器（Spec §8 术语基准的唯一事实源）。
 *
 * 扫描 docs/**\/*.md、skills/**\/*.{yaml,md}、src/**\/*.ts、README.md，
 * 检出已知混用点：
 *   - 回滚 → 回退
 *   - MUST NOT → SHALL NOT
 *   - archive-inprogress → archive-in-progress
 *   - src 代码中 `门禁` → suspect（canonical=阶段守卫）
 *
 * 白名单：.mumuspec/glossary-allowlist.yaml（{file, line?, pattern}）。
 * glossary.md 缺失 → 软 WARN（glossary-missing），不崩溃。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readYaml, normalizePath, SKIP_DIRS } from '../core/utils.js';

export interface GlossaryFinding {
  file: string;
  line?: number;
  type: 'rollback' | 'must-not' | 'archive-inprogress' | 'gate' | 'glossary-missing';
  /** 命中的禁用写法（literal），供白名单匹配 */
  pattern: string;
  /** 建议的唯一写法 */
  suggestion: string;
}

export interface GlossaryCheckResult {
  findings: GlossaryFinding[];
  count: number;
}

export interface GlossaryCheckOptions {
  /** strict=true 时，`门禁` 在 docs/skills 文档中也报 suspect（默认仅 src 代码） */
  strict?: boolean;
}

interface GlossaryRule {
  type: GlossaryFinding['type'];
  term: string;
  regex: RegExp;
  suggestion: string;
  /** 'all' — 所有扫描文件；'src' — 仅 src/**\/*.ts */
  scope: 'all' | 'src';
}

interface AllowlistEntry {
  file?: string;
  line?: number;
  pattern?: string;
}

const RULES: GlossaryRule[] = [
  { type: 'rollback', term: '回滚', regex: /回滚/g, suggestion: '回退', scope: 'all' },
  { type: 'must-not', term: 'MUST NOT', regex: /\bMUST NOT\b/g, suggestion: 'SHALL NOT', scope: 'all' },
  { type: 'archive-inprogress', term: 'archive-inprogress', regex: /archive-inprogress/g, suggestion: 'archive-in-progress', scope: 'all' },
  { type: 'gate', term: '门禁', regex: /门禁/g, suggestion: '阶段守卫', scope: 'src' },
];

// doc-governance-decisions (2026-09-06): 权威术语表为 .mumuspec/glossary.md
// （根 spec.md GLOSSARY-1）；docs/reference/glossary.md 仅为对外薄入口。
const GLOSSARY_MD_REL = '.mumuspec/glossary.md';
const ALLOWLIST_REL = '.mumuspec/glossary-allowlist.yaml';

/** 扫描根目录时跳过的目录 */
// SKIP_DIRS 已统一收编到 core/utils.js（Phase 3.4）

/**
 * 运行术语漂移扫描。
 * 返回 findings（每个命中一条，含文件/行/类型/禁用写法/建议）与 count。
 */
export function checkGlossary(
  projectRoot: string,
  opts: GlossaryCheckOptions = {},
): GlossaryCheckResult {
  const findings: GlossaryFinding[] = [];

  // glossary.md 缺失 → 软 WARN
  if (!existsSync(join(projectRoot, GLOSSARY_MD_REL))) {
    findings.push({
      file: GLOSSARY_MD_REL,
      type: 'glossary-missing',
      pattern: '<missing>',
      suggestion: '创建 .mumuspec/glossary.md 作为术语唯一基准',
    });
  }

  const allowlist = loadAllowlist(projectRoot);
  const files = collectScanFiles(projectRoot);

  for (const absPath of files) {
    const rel = normalizePath(relative(projectRoot, absPath));
    const isSrc = rel.startsWith('src/') && absPath.endsWith('.ts');
    let content: string;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      continue; // 读取失败跳过
    }
    if (content.includes('\u0000')) continue; // 二进制/非文本跳过

    for (const rule of RULES) {
      const applies = rule.scope === 'all'
        ? true
        : isSrc || (opts.strict === true && !isSrc);
      if (!applies) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        rule.regex.lastIndex = 0;
        if (!rule.regex.test(lines[i])) continue;
        rule.regex.lastIndex = 0;

        const finding: GlossaryFinding = {
          file: rel,
          line: i + 1,
          type: rule.type,
          pattern: rule.term,
          suggestion: rule.suggestion,
        };
        if (isAllowlisted(allowlist, finding)) continue;
        findings.push(finding);
      }
    }
  }

  return { findings, count: findings.length };
}

/** 收集扫描范围内的文件（docs/**\/*.md、skills/**\/*.{yaml,md}、src/**\/*.ts、README.md） */
function collectScanFiles(projectRoot: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(abs);
      } else if (entry.isFile()) {
        const rel = normalizePath(relative(projectRoot, abs));
        const inDocs = rel.startsWith('docs/') && abs.endsWith('.md');
        const inSkills = rel.startsWith('skills/') && (abs.endsWith('.md') || abs.endsWith('.yaml') || abs.endsWith('.yml'));
        const inSrc = rel.startsWith('src/') && abs.endsWith('.ts');
        const isReadme = rel === 'README.md';
        if (inDocs || inSkills || inSrc || isReadme) files.push(abs);
      }
    }
  }

  walk(projectRoot);
  return files;
}

/** 加载白名单 .mumuspec/glossary-allowlist.yaml */
function loadAllowlist(projectRoot: string): AllowlistEntry[] {
  const allowPath = join(projectRoot, ALLOWLIST_REL);
  if (!existsSync(allowPath)) return [];
  const raw = readYaml<AllowlistEntry[] | AllowlistEntry>(allowPath);
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((e) => e && typeof e === 'object');
}

/** 命中白名单（同文件 + 同 pattern/type；指定 line 则需同行）则压制 */
function isAllowlisted(allowlist: AllowlistEntry[], finding: GlossaryFinding): boolean {
  for (const entry of allowlist) {
    if (!entry) continue;
    if (entry.file !== undefined && normalizePath(entry.file) !== finding.file) continue;
    if (entry.line !== undefined && entry.line !== finding.line) continue;
    if (entry.pattern !== undefined && entry.pattern !== finding.pattern && entry.pattern !== finding.type) continue;
    return true;
  }
  return false;
}
