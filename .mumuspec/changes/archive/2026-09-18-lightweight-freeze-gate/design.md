# Design: lightweight-freeze-gate

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

对标 Comet Native（0.4）与 OpenSpec `skip_specs` 的轻量化实证，为 mumuspec 轻量档（tweak/hotfix）补齐三件事：需求冻结的结构化用户决策确认（freeze gate）、spec 最小可解析单元、零行为变更免 delta 逃生舱。核心原则：**默认零新增硬门**（保持 CHG-5「只增不改」），新增门禁仅在 proposal 显式声明 blocking 用户决策时生效；full workflow 零改动。

## 实现

### 1. 需求冻结确认门（freeze gate）

- `src/change/proposal.ts`（新，纯函数）：`parseUserDecisions(proposalMd): UserDecision[]`
  - 解析 `## User Decisions` 段；条目以 `- [blocking] ` 前缀识别 bool 阻塞性；返回 `{ text, blocking }[]`。
- `src/guard/phase-guard.ts` `checkOpenToBuildHotfix`：
  - 读取 proposal → `parseUserDecisions`；`blocking = decisions.filter(d => d.blocking)`
  - `blocking.length === 0` → 直接返回现状（**无新增约束**，CHG-5 回归点）
  - 否则逐项检查 decisions.md（复用尾随条目，签收 = 去空白后的条目文本子串命中）：存在未签收项 → errors 列出未签收条目（新错误码 `E-GUARD-011`）；全部签收 → 通过
- 签收机制复用现有 decisions.md（`mumuspec decisions append`），不引入交互式向导（对齐 Init/new SHALL NOT 交互红线）。

### 2. spec 最小可解析单元

- `src/spec/validator.ts`：新增纯谓词 `isMinParseableUnit(spec)`——**单条 `## Requirement:` + 一条 `### SHALL`（或 `### SHALL NOT`）项即构成合法最小单元**（对应 OpenSpec/Comet 的机器可解析面，WHEN/THEN 验收语义以 SHALL 项措辞表达）；
- 轻量档（tweak/hotfix）delta 依此谓词放行；full workflow 的校验行为不变（不加不减，E-SPEC-004 仍在零 requirements 时告警）。

### 3. 零行为变更逃生舱

- `src/core/types-workflow.ts`：`ChangeState` 新增可选字段 `skip_specs?: boolean`。
- `src/cli/commands/change.ts` `new`：新增 `--no-spec-delta` 选项 → `state.skip_specs = true`；proposal 模板同时补充 `## User Decisions` 段（空段即可，无声明即无硬门）。
- `src/guard/phase-guard.ts`：`skip_specs=true` 时 open→build 不产生「delta-specs 缺失」warning（现状本为 warning，正式化语义）。
- verify/archive 不新增逻辑：结果约束（测试绿 + 漂移检查）与归档合并对无 delta 变更已是 no-op（YAGNI：不加旁路）。

## 错误码

- 新增 `E-GUARD-011`（guard 域，`FREEZE_GATE_UNSIGNED_DECISION`）：blocking 用户决策未签收。注册于 `src/core/errors.ts`（E-GUARD-010 已被 DELTA_CONSTRAINT_UNCHANNELABLE 占用）。

## 不做什么

- 不新增 workflow 档位（YAGNI：复用 tweak/hotfix，避免与既有轻量档成两条权威源）。
- 不改 full workflow 的守卫与校验语义（AC 回归锁定）。
- 不做 Comet 式独立 Native runtime / 跨设备状态同步（超出本变更范围，留待后续）。
- 不做交互式「Grill Me」式澄清向导（硬门签收走 decisions.md，非交互）。

## 测试用例

详见 `test-cases/layer-0-cases.md`（TC-L0-01 ~ TC-L0-07），Design 后经 `test-cases lock-suite` 锁定。