---
id: KE-ready-action-guidance-patterns
title: Architecture patterns from ready-action-guidance
type: pattern
status: confirmed
scope: ready-action-guidance
created_at: 2026-09-13
tags:
  - auto-extracted
  - pattern
  - architecture
  - ready-action-guidance
graph_bindings: []
---
> Auto-extracted from ready-action-guidance/design.md

# Design: ready-action-guidance

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

CLI 层组合（change/decisions.ts 的目标阶段映射 + guard/phase-guard.ts 的只读门禁判定），不引入反向依赖边。

## 实现

### D1: decisions.ts 单源化

```ts
export function getNextTargetPhase(state: ChangeState): string | undefined {
  switch (state.phase) {
    case 'open': return (state.workflow === 'hotfix' || state.workflow === 'tweak') ? 'build' : 'design';
    case 'design': return 'build';
    case 'build': return 'verify';
    case 'verify': return 'archive-in-progress';
    default: return undefined; // archive-in-progress 及其后无"下一阶段"语义（archive 命令直通）
  }
}
```
- `getNextPhaseHint` 改为基于 `getNextTargetPhase` 渲染命令字符串（行为不变，消重）。
- archive-in-progress 的提示（mumuspec archive）保留在 hint 的特例分支：target 为 archive-in-progress 时 hint 文案即 archive 命令，ready 块同样特判（该步的门禁即 archive-in-progress 自身，已过的门禁不重复展示）。

### D2: change.ts status 就绪块

```
就绪动作:
  ✓ 就绪: mumuspec state transition <name> <target> --confirm
```
或
```
就绪动作:
  ✗ 受阻（2 项）:
    - [E-GUARD-001] design.md 不存在
    - [E-GUARD-008] open-questions.yaml 缺失（…）
  完成上述项后重试: mumuspec status <name>
```
- 判定 = `runPhaseGuard(root, name, target)`（无副作用——--apply/confirm 属 executeTransition/guard CLI 的职责，runPhaseGuard 只检查）。
- archive-in-progress 阶段：特判输出 `✓ 可归档: mumuspec archive <name> --confirm`（其门禁已在 BP-17 前通过）。
- 分层合规：CLI → {change, guard} 单向；decisions.ts 不 import guard。

### D3: 不做什么

- 不做拓扑式多步预测（只给相邻下一步——OpenSpec continue 语义的最小等价）。
- 不改 `status --json`/MCP 面（后续按消费者需求扩展，避免无消费者的产出）。

## 测试用例

1. TC1 tmp 项目 + full 变更（open 阶段、无工件）→ status 输出含「✗ 受阻」与 E-GUARD-001。
2. TC2 补齐 design.md → 输出含「✓ 就绪」与 transition 命令。
3. TC3 hotfix 变更 open → 下一目标为 build（单源映射回归）。
4. TC4 既有 status 文案（变更:/Phase:/Workflow:）不回退。
