# Proposal: lightweight-freeze-gate

## Why

生态轻量化实证：Comet Native workflow（0.4.0，2026-09）将完整五阶段压缩为 Shape→Build→Verify→Archive，面向强模型只锁死「WHAT（brief + 完整 Specs）+ 验收证据」，砍掉 design/plan/tasks/TDD 强制过程，官方自测 token −76.8%、Agent 轮次 −57.4%，且人工签收前置到需求冻结（Shape→Build 阻塞门）。OpenSpec 提供 `skip_specs: true`（零行为变更免 delta）与 design.md 缺省等价逃生舱。

mumuspec 现有轻量档（tweak/hotfix）已跳过 design 阶段、过程约束多为 warning（CHG-5 结果约束策略），对照 Comet Native 仍缺三件事：

1. **需求冻结缺少结构化用户决策确认**：现有 `--confirm` 只是通用转换标志，没有「改变可见结果的决策必须逐项签收」语义（Comet 三类信息分流：可核实事实 / 用户决策 / 实现选择，`[blocking]` 清零才放行 Build）。
2. **spec 最小可解析单元下限不明确**：小变更缺少「单条 `### Requirement:` + 一条 `#### Scenario:` 即构成合法 delta」的显式保证（OpenSpec/Comet 的机器可解析面）。
3. **零行为变更 → 免 spec delta 的显式逃生舱缺失**：重构/工具/纯文档类行为性变更仍被要求写 delta，缺少 `skip_specs` 等价声明。

## What

为轻量路径（tweak/hotfix）增强三件事，默认保持 CHG-5「只增不改」兼容——新增硬门**仅在变更显式声明用户决策时生效**：

1. **需求冻结确认门（freeze gate）**：proposal 可选新增 `## User Decisions` 段，决策项可带 `[blocking]` 标记（改变可见结果、须用户确认的决策）；open→build 守卫（hotfix/tweak）在存在未签收 blocking 决策项时报错并逐项列出；无 blocking 声明或已全部签收时不加任何新约束（与现状行为一致）。
2. **最小可解析 spec 单元**：delta-spec 校验新增规则——单条 Requirement（SHALL）+ 单条 Scenario（WHEN/THEN）即为合法 delta；禁止以「内容太少/缺 Purpose」为由拒绝小型 spec 单元（仅限轻量档，full 不变）。
3. **零行为变更逃生舱**：`mumuspec new --workflow tweak --no-spec-delta`（或 proposal 声明 `skip_specs: true`）允许无 delta 的行为性变更进入 open→build；verify 以既有结果约束收口（测试全绿 + drift 检查），不新增旁路。

## Impact Scope

- `src/guard/phase-guard.ts` — `checkOpenToBuildHotfix` 增加 freeze-gate 校验（blocking 决策签收）
- `src/spec/validator.ts`（及 spec 校验相关）— 最小可解析单元规则（轻量档生效）
- `src/cli/commands/change.ts` — `new` 增加 `--no-spec-delta` 选项与 proposal 模板 `## User Decisions` 段
- `src/change/decisions.ts` — blocking 决策签收判定（复用 decisions.md 签收机制）
- `tests/guard/`、`tests/spec/`、`tests/cli/` — 新增用例
- 不新增 workflow 档位（YAGNI：复用 tweak/hotfix，避免与既有轻量档成为两条权威源）

## Acceptance Criteria

- 声明 `[blocking]` 用户决策且未逐项签收 → open→build 守卫报错并列出未签收项
- 声明项全部签收后 → 守卫通过；无 blocking 声明 → 守卫结果与现状完全一致（CHG-5 回归）
- 单条 Requirement + 单条 Scenario 的 delta 文件 → spec 校验通过（轻量档）
- `--no-spec-delta` 变更 → open→build 放行，verify 结果约束（测试 + 漂移）正常收口
- full workflow 的守卫与校验行为零变化

## Workflow

full