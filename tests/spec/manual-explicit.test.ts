/**
 * manual 显式化（manual-explicit）——W-SPEC-017 提示、结构化证据、entry 统一通道。
 *
 * TC-L0-01/02/03/04/05。
 */

import { describe, it, expect } from 'vitest';
import {
  classifyConstraintEntry,
  classifyRequirements,
  missingManualEvidence,
  parseStructuredEvidence,
} from '../../src/spec/verifier-classify.js';
import { parseSpecFile } from '../../src/spec/parser.js';
import { validateSpecFile } from '../../src/spec/validator.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function legacyEnforcementSpec(): string {
  return [
    '---',
    'layer: 0',
    'scope: "."',
    '---',
    '',
    '## Requirement: R',
    '',
    '### SHALL',
    '- 必须有 TSDoc',
    '',
    '### Enforcement',
    '- ENF-1: code review 检查',
    '',
  ].join('\n');
}

describe('parseStructuredEvidence', () => {
  it('extracts complete records (quotes optional, order free)', () => {
    const records = parseStructuredEvidence(
      '- {constraintId: "ENF-1", user: "alice", verdict: "pass", timestamp: "2026-09-18", evidence_hash: "abc123"}\n' +
      '- {constraintId: "ENF-2", verdict: "fail"}',
    );
    expect(records).toHaveLength(2);
    expect(records[0].constraintId).toBe('ENF-1');
    expect(records[0].evidenceHash).toBe('abc123');
    expect(records[1].verdict).toBe('fail');
    expect(records[1].evidenceHash).toBeUndefined();
  });

  it('ignores non-record braces', () => {
    expect(parseStructuredEvidence('普通文本 {} 无 constraintId')).toHaveLength(0);
  });
});

describe('missingManualEvidence 结构化回落', () => {
  const items = classifyRequirements(
    [{
      name: 'R1',
      shall: ['必须有 TSDoc'],
      shallNot: [],
      should: [],
      enforcement: [{ id: 'ENF-1', description: 'review 检查', kind: 'implicit-manual', severity: 'ERROR' }],
    } as const],
    [], 'spec.md',
  );

  it('TC-L0-03: 结构完整记录（verdict + evidence_hash）按 id 命中即满足', () => {
    const missing = missingManualEvidence(
      '# Verify\n- {constraintId: "ENF-1", user: "alice", verdict: "pass", timestamp: "2026-09-18", evidence_hash: "abc123"}\n',
      items,
    );
    expect(missing).toHaveLength(0);
  });

  it('TC-L0-04: 无结构化记录 → 回落既有文本锚点（enforcementId 包含）', () => {
    const missing = missingManualEvidence('# Verify\nENF-1 已由 code review 覆盖。\n', items);
    expect(missing).toHaveLength(0);
  });

  it('结构不完整记录（缺 evidence_hash）不豁免，回落文本锚点仍判定', () => {
    const missing = missingManualEvidence(
      '# Verify\n- {constraintId: "ENF-1", verdict: "pass", user: "alice"}\n',
      items,
    );
    expect(missing).toHaveLength(1);
  });
});

describe('W-SPEC-017 advisory', () => {
  it('TC-L0-01: legacy 自由文本 enforcement（implicit-manual）→ W-SPEC-017 告警', () => {
    const dir = join(tmpdir(), `mumuspec-a3-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    const specPath = join(dir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, legacyEnforcementSpec());
    const result = validateSpecFile(specPath);
    expect(result.warnings.some((w) => w.code === 'W-SPEC-017')).toBe(true);
    // 分类不改变：manual 项目不产生新 error
    expect(result.errors.some((e) => e.code === 'E-SPEC-004')).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('TC-L0-02: 显式 manual(reason) → 无 W-SPEC-017', () => {
    const spec = legacyEnforcementSpec().replace('- ENF-1: code review 检查', '- ENF-1: manual(人工核对)');
    const parsed = parseSpecFile(spec, 'spec.md');
    expect(parsed.requirements[0].enforcement[0].kind).toBe('manual');
    const dir = join(tmpdir(), `mumuspec-a3b-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    const specPath = join(dir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, spec);
    const result = validateSpecFile(specPath);
    expect(result.warnings.some((w) => w.code === 'W-SPEC-017')).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('classifyConstraintEntry 统一通道', () => {
  it('TC-L0-05: 空 enforcement + 引号词 → enforced-weak；无引号词 → unverifiable；manual(...) → manual', () => {
    expect(classifyConstraintEntry({ id: 'A', content: '禁止使用 `eval`', enforcement: '' })).toBe('enforced-weak');
    expect(classifyConstraintEntry({ id: 'B', content: '禁止引入未被请求的抽象层', enforcement: '' })).toBe('unverifiable');
    expect(classifyConstraintEntry({ id: 'C', content: '模块职责单一', enforcement: 'manual(架构评审核对)' })).toBe('manual');
  });
});