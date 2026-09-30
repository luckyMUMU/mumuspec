/**
 * Sensitive-info scan — deterministic pattern audit over normative artifacts.
 *
 * `.mumuspec/prohibitions.md` lists `sensitive_info_scan` among the constraints
 * that stay enforced regardless of strength (`BUILTIN_CONSTRAINT_EXCEPTIONS`),
 * and `docs/reference/configuration.md` repeats it as non-closable. Until this
 * module existed, that claim had no consumer: the scan named the always-on gate
 * simply did not run. There is deliberately **no config switch** here — the
 * exception list says the gate cannot be turned off, so a knob would contradict
 * the prohibition it is supposed to serve.
 *
 * Findings are advisory (WARN): specification text legitimately quotes credential
 * *shapes*. The scan reports what looks like a live value, masked, and leaves the
 * judgement to the reader — it never rewrites or deletes the artifact.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { appendAuditLog } from '../core/utils.js';

export interface SensitiveFinding {
  file: string;
  line: number;
  pattern: string;
  /** Masked excerpt — never the full matched value. */
  excerpt: string;
}

interface Pattern {
  id: string;
  re: RegExp;
}

/** Fixed pattern set — order is stable so output is reproducible. */
const PATTERNS: readonly Pattern[] = [
  {
    id: 'credential-assignment',
    re: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\b["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/+]{12,}["']?/i,
  },
  { id: 'bearer-token', re: /\bbearer\s+[A-Za-z0-9\-._~+/]{16,}={0,2}/i },
  { id: 'private-ip', re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/ },
  { id: 'internal-hostname', re: /\b[a-z0-9][a-z0-9.-]*\.(?:internal|local|corp|intranet|lan)\b/i },
  {
    id: 'datasource-uri',
    re: /\b(?:mongodb|mysql|postgres(?:ql)?|redis|amqp|jdbc:[a-z0-9]+):\/\/[^\s'"]*:[^\s'"]*@\S+/i,
  },
];

/** Keep the shape visible, hide the value: first 4 chars + fixed mask. */
function mask(match: string): string {
  const head = match.slice(0, 4);
  return `${head}${'*'.repeat(6)}`;
}

/**
 * Markdown files that carry live obligations. `knowledge/` is an import archive
 * and `changes/archive/` frozen history — neither is a current promise, and
 * scanning them would report text the project does not own.
 */
function collectSpecFiles(root: string): string[] {
  const mumuDir = join(root, '.mumuspec');
  if (!existsSync(mumuDir)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'knowledge' || entry.name === 'archive' || entry.name === 'node_modules') continue;
        walk(p);
      } else if (entry.name.endsWith('.md')) {
        out.push(p);
      }
    }
  };
  walk(mumuDir);
  return out.sort();
}

/** Scan one file; exported for tests that need a single-artifact result. */
export function scanSensitiveText(content: string, file: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { id, re } of PATTERNS) {
      for (const m of lines[i].matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) {
        findings.push({ file, line: i + 1, pattern: id, excerpt: mask(m[0]) });
      }
    }
  }
  return findings;
}

/** Scan the normative surface of a project (pure read, no mutation). */
export function scanSensitiveInfo(projectRoot: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const abs of collectSpecFiles(projectRoot)) {
    let content = '';
    try {
      content = readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    findings.push(...scanSensitiveText(content, relative(projectRoot, abs).replace(/\\/g, '/')));
  }
  return findings;
}

/**
 * Run the scan for a `mumuspec check` pass: one advisory per affected file and an
 * audit entry when anything is reported. The audit trail is what makes the
 * always-on gate observable rather than merely asserted.
 */
export function reportSensitiveInfo(
  projectRoot: string,
  warnings: { code: string; message: string; detail?: string }[],
): number {
  const findings = scanSensitiveInfo(projectRoot);
  if (findings.length === 0) return 0;

  const byFile = new Map<string, SensitiveFinding[]>();
  for (const f of findings) {
    const bucket = byFile.get(f.file) ?? [];
    bucket.push(f);
    byFile.set(f.file, bucket);
  }

  for (const [file, items] of [...byFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const detail = items
      .slice(0, 3)
      .map((i) => `${i.file}:${i.line} ${i.pattern} ${i.excerpt}`)
      .join('; ');
    warnings.push({
      code: 'W-SECURITY-001',
      message: `${file}: 检测到 ${items.length} 处疑似敏感信息（不阻断，建议改用环境变量占位）`,
      detail,
    });
  }

  appendAuditLog(join(projectRoot, '.mumuspec'), {
    actor: 'checker:cli',
    action: 'security.sensitive_info_scan',
    result: 'fail',
    files: byFile.size,
    findings: findings.length,
  });

  return findings.length;
}
