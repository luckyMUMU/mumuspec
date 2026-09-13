# Proposal: ready-action-guidance

## Why

改进计划 B1（借鉴 OpenSpec /opsx:continue 与工件 DAG）：`mumuspec status` 的"下一步"提示是静态命令字符串，不告知**当前是否就绪**——用户需自行跑到 guard 才知道缺什么工件。58 命令面认知负担的主要来源即"下一步动作 + 就绪判定"分离。

## What

1. `mumuspec status` 输出尾部新增「就绪动作」块：对下一目标阶段实时执行 `runPhaseGuard`（非 --apply，纯只读判定），呈现三态：
   - `✓ 就绪: mumuspec state transition <name> <target> --confirm`（门禁零错误）
   - `✗ 受阻（N 项）:` + 逐条 error code + message（用户直接看到缺什么）
   - 前置 BP 确认提示（--confirm 语义不变）。
2. decisions.ts 抽出 `getNextTargetPhase(state)` 导出（单一权威源），getNextPhaseHint 复用之——下一目标阶段的映射不再有两份。
3. 纯只读：不改状态、不写工件；guard 内部对 verify→archive-in-progress 的 --apply 分支不会被触发（本处不传 --confirm 语义，runPhaseGuard 本身无副作用）。

## Impact Scope

- src/change/decisions.ts — getNextTargetPhase 抽取
- src/cli/commands/change.ts — status 输出接线
- tests/cli/ — status 就绪块断言

## Acceptance Criteria

- status 输出含「就绪动作」块；受阻时逐条列出门禁错误
- getNextPhaseHint 与 getNextTargetPhase 单源化（无重复映射）
- 既有 status 输出格式不回退；三件套全绿

## Workflow

full
