/**
 * CHG-3 — 规范同步 hash（AC-05/AC-06 及边界用例）。
 *
 * 覆盖：
 *   TC-3-1  generate → 改 spec.md → detectAgentsDrift → severity=ERROR code=E-AGENTS-001
 *   TC-3-2  generate 后未改 → 无 agents_drift
 *   TC-3-3  无 hash 文件 → WARN 非 ERROR
 *   TC-3-4  hash 被手改 → ERROR
 *   TC-3-5  子作用域 spec 变更 → 触发
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDefaultConfig } from '../src/core/config.js';
import { generateRulesFiles } from '../src/rules/generator.js';
import { detectAgentsDrift, computeSpecHash } from '../src/guard/checker.js';

let root: string;

beforeEach(() => {
  root = join(tmpdir(), `mumuspec-agents-drift-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeSpec(content: string, scope?: string): string {
  const mumuDir = scope ? join(root, scope, '.mumuspec') : join(root, '.mumuspec');
  mkdirSync(mumuDir, { recursive: true });
  const path = join(mumuDir, 'spec.md');
  writeFileSync(path, content, 'utf8');
  return path;
}

function runGenerate(): void {
  const config = getDefaultConfig('agents-drift-test');
  config.ai.rules_files = ['AGENTS.md'];
  generateRulesFiles(root, config);
}

describe('CHG-3 规范同步 hash', () => {
  it('TC-3-1 generate → 改 spec.md → detectAgentsDrift 报 ERROR E-AGENTS-001', () => {
    writeSpec('# Spec v1\n\n## Requirement: R1\nSHALL: do thing\n');
    runGenerate();
    expect(existsSync(join(root, '.mumuspec', 'agents-hash.json'))).toBe(true);

    // 修改 spec.md（生成后变化）
    writeSpec('# Spec v1 (modified)\n\n## Requirement: R1\nSHALL: do thing changed\n');

    const drifts = detectAgentsDrift(root);
    const hit = drifts.find((d) => d.type === 'agents_drift');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('ERROR');
    expect(hit!.code).toBe('E-AGENTS-001');
  });

  it('TC-3-2 generate 后未改 → 无 agents_drift', () => {
    writeSpec('# Spec v1\n\n## Requirement: R1\nSHALL: do thing\n');
    runGenerate();

    const drifts = detectAgentsDrift(root);
    expect(drifts.filter((d) => d.type === 'agents_drift')).toHaveLength(0);
  });

  it('TC-3-3 边界：无 hash 文件 → WARN 非 ERROR', () => {
    writeSpec('# Spec v1\n');

    const drifts = detectAgentsDrift(root);
    const hit = drifts.find((d) => d.type === 'agents_drift');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('WARN');
    expect(hit!.code).toBeUndefined();
  });

  it('TC-3-4 边界：hash 被手改 → ERROR', () => {
    writeSpec('# Spec v1\n');
    runGenerate();

    const hashPath = join(root, '.mumuspec', 'agents-hash.json');
    const hash = JSON.parse(readFileSync(hashPath, 'utf8'));
    hash.specHash = 'deadbeef00000000';
    writeFileSync(hashPath, JSON.stringify(hash, null, 2), 'utf8');

    const drifts = detectAgentsDrift(root);
    const hit = drifts.find((d) => d.type === 'agents_drift');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('ERROR');
    expect(hit!.code).toBe('E-AGENTS-001');
  });

  it('TC-3-5 边界：子作用域 spec 变更 → 触发', () => {
    writeSpec('# Root spec\n');
    writeSpec('# Sub spec v1\n', 'sub');
    runGenerate();

    // 变更子作用域 spec
    writeSpec('# Sub spec v2 (changed)\n', 'sub');

    const drifts = detectAgentsDrift(root);
    const hit = drifts.find((d) => d.type === 'agents_drift');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('ERROR');
    expect(hit!.code).toBe('E-AGENTS-001');
  });

  it('computeSpecHash 对同内容稳定、对异内容不同', () => {
    writeSpec('# Spec stable\n');
    runGenerate();
    const h1 = computeSpecHash(root);

    writeSpec('# Spec stable\n');
    const h2 = computeSpecHash(root);
    expect(h1).toBe(h2);

    writeSpec('# Spec changed\n');
    const h3 = computeSpecHash(root);
    expect(h3).not.toBe(h1);
  });
});
