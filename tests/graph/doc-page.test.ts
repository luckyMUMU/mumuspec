/**
 * Generated diagram page and its reconciliation channel (R-0019, RENDER-3).
 *
 * The document is a projection of graph data, so the only honest gate over it is
 * byte equality with a fresh build. These tests lock both halves: the projection
 * is deterministic, and a single edited line is detected.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDiagramDocPage,
  diffAgainstProjection,
  diagramDocDrift,
  DIAGRAM_DOC_RELATIVE,
} from '../../src/graph/doc-page.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('buildDiagramDocPage', () => {
  it('is byte-identical across two renders', () => {
    expect(buildDiagramDocPage(REPO_ROOT)).toBe(buildDiagramDocPage(REPO_ROOT));
  });

  it('carries all four views and the generated banner', () => {
    const page = buildDiagramDocPage(REPO_ROOT);
    expect(page.startsWith('# Workflow Diagrams (generated)')).toBe(true);
    for (const title of ['状态机（full 工作流）', '阶段×阻塞点泳道', '契约上下游', '约束继承树（根路径）']) {
      expect(page).toContain(`## ${title}`);
    }
    expect(page.match(/```mermaid/g)).toHaveLength(4);
  });

  it('keeps ungated and gate-free structures visible instead of omitting them', () => {
    const page = buildDiagramDocPage(REPO_ROOT);
    expect(page).toContain('未把守'); // 边上无阻塞点仍出现在图里
    expect(page).toContain('无门禁'); // 终态阶段没有门禁也画出来
  });
});

describe('diagramDocDrift / diffAgainstProjection', () => {
  it('reports no drift for the committed page', () => {
    expect(diagramDocDrift(REPO_ROOT)).toEqual({ drifted: false, detail: '' });
  });

  it('locates the first differing line when the page was hand-edited', () => {
    const committed = readFileSync(join(REPO_ROOT, DIAGRAM_DOC_RELATIVE), 'utf-8');
    const tampered = committed.replace('flowchart LR', 'flowchart TD');
    const editedLine = committed.split(/\r?\n/).findIndex((l) => l === 'flowchart LR') + 1;
    const result = diffAgainstProjection(committed, tampered);
    expect(result.drifted).toBe(true);
    expect(result.detail).toContain(`第 ${editedLine} 行`);
    expect(result.detail).toContain('flowchart TD');
  });

  it('treats a truncated page as drift at the cut point', () => {
    const committed = readFileSync(join(REPO_ROOT, DIAGRAM_DOC_RELATIVE), 'utf-8');
    const lines = committed.split(/\r?\n/);
    const half = `${lines.slice(0, 12).join('\n')}\n`;
    const result = diffAgainstProjection(committed, half);
    expect(result.drifted).toBe(true);
    expect(result.detail).toContain('第 13 行');
  });

  it('reports an empty document as drift rather than agreement', () => {
    expect(diffAgainstProjection('# anything\n', '').detail).toContain('不存在或为空');
  });
});
