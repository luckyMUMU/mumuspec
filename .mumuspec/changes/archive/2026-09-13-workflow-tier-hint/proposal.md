# Proposal: workflow-tier-hint

## Why

改进计划 B3（借鉴 BMAD 三档自适应 / Kiro Quick Plan）：`recommendPath` 分档引擎已存在且只推荐不裁决，但档位失配是**隐式的**——用户以 full 创建小变更时，输出仅有一行 "Recommended: tweak (85%)"，不说明"当前档位与建议不一致、如何调整"。规模自适应的最后一步是把失配显式化。

## What

`mumuspec new` 在有 scope 信号且 `recommendPath().path !== 实际使用 workflow` 时，输出显式提示行：

```
  ⚠ 规模建议: tweak —— <rationale>
    如需调整: mumuspec discard <name> --confirm 后以 --workflow tweak 重建
```

一致时输出 `  ✓ 档位匹配: <workflow>`。只提示不裁决（L1 Suggestion 模式不变）。

## Impact Scope

- src/cli/commands/change.ts — new 输出尾部提示行
- tests/cli/ — 提示行断言（unit 级：推荐与 workflow 一致/不一致两态）

## Acceptance Criteria

- 信号指示 tweak 而实际 full → 输出 ⚠ 规模建议行 + 调整指引
- 信号指示与实际一致 → ✓ 档位匹配
- 无 scope 信号 → 无提示行（诚实缺省）
- 三件套不回退

## Workflow

full
