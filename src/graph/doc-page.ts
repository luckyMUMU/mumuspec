/**
 * Generated diagram page — the reconciliation carrier (R-0019, RENDER-3).
 *
 * `docs/reference/workflow-diagrams.md` is produced here rather than hand-written,
 * so a document that claims "this is how the orchestration looks" is a projection
 * of the graph data instead of a second account of it. Reconciliation is then
 * byte equality against a fresh build: no layout judgement, no semantic guessing,
 * and nothing a reader has to trust.
 *
 * Change state is deliberately excluded — the committed page must not churn every
 * time a change moves between phases, so `RenderOpts.state` is never passed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildConstraintTreeInput,
  buildContractGraphInput,
  buildWorkflowGraphInput,
} from './facts.js';
import {
  renderBpLanes,
  renderConstraintTree,
  renderContractGraph,
  renderStateMachine,
  type RenderOpts,
} from './render.js';

const MERMAID: RenderOpts = { format: 'mermaid' };
const GENERATED = [
  '# Workflow Diagrams (generated)',
  '',
  '> **Auto-generated** from graph data via `src/graph/doc-page.ts`. Do not edit manually.',
  '> Regenerate: `npm run build` — drift is reported by `npm run docs:audit`.',
  '',
];

interface Section {
  title: string;
  note: string;
  body: string;
}

function sections(projectRoot: string): Section[] {
  const workflow = buildWorkflowGraphInput(projectRoot, 'full');
  return [
    {
      title: '状态机（full 工作流）',
      note: '节点为阶段，边为转移；未挂门禁的边标注"未把守"，回退边与正向边以类别区分。',
      body: renderStateMachine(workflow, MERMAID),
    },
    {
      title: '阶段×阻塞点泳道',
      note: '每个阶段一条泳道；泳道内为 `无门禁` 即该阶段当前没有任何阻塞点把守。',
      body: renderBpLanes(workflow, MERMAID),
    },
    {
      title: '契约上下游',
      note: '孤立节点表示该契约既无上游也无下游；指向未声明节点的边由渲染器拒绝而非静默补齐。',
      body: renderContractGraph(buildContractGraphInput(projectRoot), MERMAID),
    },
    {
      title: '约束继承树（根路径）',
      note: '边表示继承来源；无上游来源的层即断链，保留在图上而不是被省略。',
      body: renderConstraintTree(buildConstraintTreeInput(projectRoot, '.'), MERMAID),
    },
  ];
}

/** Full markdown page for the generated diagram document. */
export function buildDiagramDocPage(projectRoot: string): string {
  const parts = [...GENERATED];
  for (const section of sections(projectRoot)) {
    parts.push(`## ${section.title}`, '', section.note, '', '```mermaid', section.body.trimEnd(), '```', '');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

export const DIAGRAM_DOC_RELATIVE = join('docs', 'reference', 'workflow-diagrams.md');

/**
 * Locate where a document stops matching a fresh projection. Pure so the
 * reconciliation itself is testable without a stale fixture on disk.
 */
export function diffAgainstProjection(expected: string, actual: string): { drifted: boolean; detail: string } {
  if (actual === expected) return { drifted: false, detail: '' };
  if (actual === '') return { drifted: true, detail: '文件不存在或为空——运行 npm run build 生成' };
  const expectedLines = expected.split(/\r?\n/);
  const actualLines = actual.split(/\r?\n/);
  let line = 0;
  while (line < expectedLines.length && line < actualLines.length && expectedLines[line] === actualLines[line]) {
    line++;
  }
  return {
    drifted: true,
    detail: `首个差异在第 ${line + 1} 行（文档 ${JSON.stringify(actualLines[line] ?? '<EOF>')} ≠ 图数据 ${JSON.stringify(
      expectedLines[line] ?? '<EOF>',
    )}）`,
  };
}

/** Drift between the committed page and a fresh projection. */
export function diagramDocDrift(projectRoot: string): { drifted: boolean; detail: string } {
  const expected = buildDiagramDocPage(projectRoot);
  let actual = '';
  try {
    actual = readFileSync(join(projectRoot, DIAGRAM_DOC_RELATIVE), 'utf-8');
  } catch {
    return { drifted: true, detail: '文件不存在——运行 npm run build 生成' };
  }
  return diffAgainstProjection(expected, actual);
}
