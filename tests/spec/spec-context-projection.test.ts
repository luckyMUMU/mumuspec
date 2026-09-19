/**
 * Context 声明式投影（spec-context-projection）——TC-L0-01/02/03。
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSpecContext } from '../../src/spec/loader.js';
import { loadConfig } from '../../src/core/config.js';

const TECH_WITH_THREE = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: A',
  '',
  '### SHALL',
  '- 规则 A',
  '',
  '## Requirement: B',
  '',
  '### SHALL',
  '- 规则 B',
  '',
  '## Requirement: C',
  '',
  '### SHALL NOT',
  '- 禁止 C',
  '',
].join('\n');

function createProject(specDoc: string, designDoc: string): string {
  const dir = join(tmpdir(), `mumuspec-proj-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  writeFileSync(join(dir, '.mumuspec', 'tech.md'), specDoc);
  if (designDoc) writeFileSync(join(dir, '.mumuspec', 'design.md'), designDoc);
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const DESIGN = '---\nlayer: 0\nscope: "."\n---\n\n# Design\n\nfixture\n';

describe('spec-context-projection', () => {
  it('TC-L0-01: 声明 disclosure 后只保留清单板块', () => {
    const disclosed = TECH_WITH_THREE.replace('scope: "."', 'scope: "."\ndisclosure:\n  - A');
    const dir = createProject(disclosed, DESIGN);
    try {
      const ctx = loadSpecContext(dir, dir, loadConfig(dir));
      const layer = ctx.layers[0];
      expect(layer.tech!.requirements.map((r) => r.name)).toEqual(['A']);
      expect(layer.tech!.content).toContain('## Requirement: A');
      expect(layer.tech!.content).not.toContain('## Requirement: B');
      expect(layer.tech!.content).not.toContain('## Requirement: C');
      expect(ctx.prohibitions.some((p) => p.includes('禁止 C'))).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('TC-L0-02: 未声明 disclosure → 输出与解析器 body 逐字节一致（无投影）', () => {
    const dir = createProject(TECH_WITH_THREE, DESIGN);
    try {
      const ctx = loadSpecContext(dir, dir, loadConfig(dir));
      const layer = ctx.layers[0];
      // 解析器 content 为去 frontmatter 的 body；未声明时 content 与 source body 一致
      const body = TECH_WITH_THREE.replace(/^---\n[\s\S]*?\n---\n/, '');
      expect(layer.tech!.content).toBe(body);
      expect(layer.tech!.requirements.map((r) => r.name)).toEqual(['A', 'B', 'C']);
    } finally {
      cleanup(dir);
    }
  });

  it('TC-L0-03: 投影机械性——未命中名与顶层非 Requirement 区块被丢弃', () => {
    const withOther = TECH_WITH_THREE + '\n## Appendix: 附加\n\n非 requirement 段落\n';
    const disclosed = withOther.replace('scope: "."', 'scope: "."\ndisclosure:\n  - A\n  - NotExists');
    const dir = createProject(disclosed, DESIGN);
    try {
      const ctx = loadSpecContext(dir, dir, loadConfig(dir));
      const layer = ctx.layers[0];
      expect(layer.tech!.requirements.map((r) => r.name)).toEqual(['A']);
      expect(layer.tech!.content).toContain('## Requirement: A');
      expect(layer.tech!.content).not.toContain('Appendix');
      expect(layer.tech!.content).not.toContain('非 requirement 段落');
    } finally {
      cleanup(dir);
    }
  });
});