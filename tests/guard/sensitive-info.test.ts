/**
 * sensitive-info scan — pattern coverage, masking, scope, and check wiring.
 *
 * The scan exists because `sensitive_info_scan` is advertised as an always-on
 * gate (prohibitions.md, configuration.md). These tests are the evidence that the
 * gate does something rather than merely being named.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scanSensitiveText, scanSensitiveInfo, reportSensitiveInfo } from '../../src/guard/sensitive-info.js';

const SAMPLES: Record<string, string> = {
  'credential-assignment': 'api_key = "sk_live_9f8a7b6c5d4e3f2a1b"',
  'bearer-token': 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'private-ip': 'connect to 10.24.7.91:5432 first',
  'internal-hostname': 'wiki.corp.example is the source of truth',
  'datasource-uri': 'DATABASE_URL=postgres://admin:s3cr3t@db.internal:5432/app',
};

describe('scanSensitiveText', () => {
  it('fires once per declared pattern', () => {
    for (const [pattern, line] of Object.entries(SAMPLES)) {
      const findings = scanSensitiveText(line, 'sample.md');
      expect(findings.map((f) => f.pattern), pattern).toContain(pattern);
    }
  });

  it('reports the line number of the match', () => {
    const findings = scanSensitiveText('# title\n\nhost = 192.168.0.7\n', 'a.md');
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(3);
    expect(findings[0].file).toBe('a.md');
  });

  it('masks the value instead of echoing it', () => {
    const findings = scanSensitiveText(SAMPLES['credential-assignment'], 'a.md');
    const excerpt = findings[0].excerpt;
    expect(excerpt).not.toContain('9f8a7b6c5d4e3f2a1b');
    expect(excerpt).toMatch(/^\w{4}\*{6}$/);
  });

  it('stays silent on clean specification text', () => {
    expect(
      scanSensitiveText(
        ['密码通过环境变量注入，不落盘。', '示例：`<API_KEY>`', '内网地址不写在规范里。'].join('\n'),
        'clean.md',
      ),
    ).toEqual([]);
  });
});

describe('scanSensitiveInfo / reportSensitiveInfo', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'mumuspec-sensitive-'));
    mkdirSync(join(root, '.mumuspec', 'changes', 'demo'), { recursive: true });
    mkdirSync(join(root, '.mumuspec', 'knowledge', 'patterns'), { recursive: true });
    mkdirSync(join(root, '.mumuspec', 'changes', 'archive', '2026-01-01-old'), { recursive: true });
    writeFileSync(join(root, '.mumuspec', 'spec.md'), 'api_key = "sk_live_9f8a7b6c5d4e3f2a1b"\n', 'utf-8');
    writeFileSync(
      join(root, '.mumuspec', 'changes', 'demo', 'decisions.md'),
      'DATABASE_URL=postgres://admin:s3cr3t@db.internal:5432/app\n',
      'utf-8',
    );
    writeFileSync(join(root, '.mumuspec', 'knowledge', 'patterns', 'KP-0001.md'), '10.0.0.1\n', 'utf-8');
    writeFileSync(
      join(root, '.mumuspec', 'changes', 'archive', '2026-01-01-old', 'design.md'),
      '172.16.0.9\n',
      'utf-8',
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('scans the normative surface and skips imports and frozen history', () => {
    const files = new Set(scanSensitiveInfo(root).map((f) => f.file));
    expect(files.has(join('.mumuspec', 'spec.md').replace(/\\/g, '/'))).toBe(true);
    expect(files.has(join('.mumuspec/knowledge/patterns/KP-0001.md').replace(/\\/g, '/'))).toBe(false);
    expect(
      files.has(join('.mumuspec/changes/archive/2026-01-01-old/design.md').replace(/\\/g, '/')),
    ).toBe(false);
  });

  it('emits one advisory per affected file and records the audit entry', () => {
    const warnings: { code: string; message: string; detail?: string }[] = [];
    const count = reportSensitiveInfo(root, warnings);
    expect(count).toBeGreaterThan(0);
    expect(warnings).toHaveLength(2);
    for (const w of warnings) {
      expect(w.code).toBe('W-SECURITY-001');
      expect(w.detail).toBeDefined();
    }
    const audit = readFileSync(join(root, '.mumuspec', 'audit.log'), 'utf-8');
    expect(audit).toContain('"action":"security.sensitive_info_scan"');
  });

  it('writes no audit entry when nothing is reported', () => {
    const cleanRoot = mkdtempSync(join(tmpdir(), 'mumuspec-sensitive-clean-'));
    try {
      mkdirSync(join(cleanRoot, '.mumuspec'), { recursive: true });
      writeFileSync(join(cleanRoot, '.mumuspec', 'spec.md'), '本文件不含凭据。\n', 'utf-8');
      const warnings: { code: string; message: string; detail?: string }[] = [];
      expect(reportSensitiveInfo(cleanRoot, warnings)).toBe(0);
      expect(warnings).toEqual([]);
      expect(existsSync(join(cleanRoot, '.mumuspec', 'audit.log'))).toBe(false);
    } finally {
      rmSync(cleanRoot, { recursive: true, force: true });
    }
  });
});
