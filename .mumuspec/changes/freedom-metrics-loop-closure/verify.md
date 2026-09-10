# Verify: freedom-metrics-loop-closure

## 测试结果

### 单元测试

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/change/loop-evaluation-suggestions.test.ts | 4 | PASS |
| tests/core/metrics/collect-metrics.test.ts | 5 | PASS |
| tests/core/metrics/constraint-density.test.ts | 8 | PASS |
| tests/core/metrics/auto-evaluate.test.ts | 16 | PASS |
| tests/core/metrics/freedom-suggestions.test.ts | 7 | PASS |
| tests/core/metrics/design-build-first-pass.test.ts | 5 | PASS |
| tests/core/consistency/metadata-alignment.test.ts | 2 | PASS |
| tests/cli/commands/check-json.test.ts | 8 | PASS |
| **合计** | **55** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 256（255 PASS / 1 FAIL） |
| 测试用例 | 4969（4968 PASS / 1 FAIL） |

唯一失败：`tests/cli/cli-smoke.test.ts > mumuspec check runs (dogfooding) with exit 0`。

失败根因为 **59 条既有 E-GUARD-003 违规**（单一规则："SHALL NOT 仅以 `.mumuspec` 存在性判定模块"），
与本次变更无关，判定依据：

| 判定项 | 证据 |
|--------|------|
| 违规数量与本次改动无关 | 回退本次 `.mumuspec/config.yaml` 改动前后，`mumuspec check` 违规计数同为 59 |
| 命中文件中的行未由本次引入 | `src/change/loop-engine.ts:564`（worktree 路径拼接）、`src/cli/index.ts:429`（console 文案字符串）、`src/core/metrics/constraint-density.ts:63`（`readAffectedScopes` 既有实现）——三处均非本次新增行 |
| 违规规则单一 | 59 条全部为 E-GUARD-003 同一条规则的宽匹配扩散，无新增规则类别 |

### TypeScript 编译

- `npx tsc --noEmit` — 0 errors

### 规范校验与漂移

- `mumuspec validate` — All specs are valid
- `mumuspec drift` — No drift detected

## SHALL / SHALL NOT 校验记录

### Requirement: advisory 建议必须抵达消费者

| 约束 | 状态 | 证据 |
|------|------|------|
| SHALL `LoopEvaluation` 保留 `suggestions` 字段，由 `autoEvaluate()` 结果直传 | DONE | `src/core/types-loop.ts` 新增字段；`src/change/loop-engine.ts` 转换层赋值；ENF-1 测试断言非空且与输入一致 |
| SHALL `MetricsSnapshot` 持久化当轮 `suggestions` | DONE | `src/core/metrics/types.ts` 新增字段；ENF-2 测试断言快照保留建议 |
| SHALL `mumuspec loop evaluate` 在建议非空时打印建议段并标注"须人工签收后生效" | DONE | `src/cli/commands/loop.ts` 建议打印段 |
| SHALL 建议经 CLI 写入 decisions.md 的 advisory 条目 | DONE | 本轮改动的实现期与签收决策均经 `mumuspec decisions append` 落条，未手工编辑 |
| SHALL NOT 存在产出物无消费者的死端 | SATISFIED | 建议产出物现有三处消费者：LoopEvaluation 字段、MetricsSnapshot 持久化、`mumuspec metrics` 输出；ENF-1/ENF-2 锁定 |
| SHALL NOT 自动应用建议（`constraint_strength` 不得被改写） | SATISFIED | 无任何写回 `constraint_strength` 的代码路径；ENF-2 断言配置文件字节不变 |

### Requirement: 自由度信号在非 loop 路径可达

| 约束 | 状态 | 证据 |
|------|------|------|
| SHALL 新增只读命令 `mumuspec metrics [change] [--json]`，任意工作流下可计算 | DONE | `src/cli/commands/metrics.ts`；实跑 `mumuspec metrics` 返回两项指标值与建议 |
| SHALL 复用既有 `Evaluator` 接口与 `evaluator-registry` | DONE | 命令经 `collectMetrics` 复用 `getActiveEvaluators()`，未另建度量实现 |
| SHALL 命令为纯只读（不写状态工件、不触发阶段转换、可重复执行） | DONE | 走 `collectMetrics` 纯采集路径，绕开 `autoEvaluate` 的 `recordProgress` 副作用；ENF-4 断言 state 文件字节不变 |
| SHALL NOT 使自由度指标仅在 loop 工作流可计算 | SATISFIED | `default_workflow: full` 的变更（本仓库默认）现经 `mumuspec metrics` 可计算；ENF-3 测试覆盖非 loop 变更 |
| SHALL NOT 改变既有 `loop evaluate` 的收敛语义（composite 权重与阈值不动） | SATISFIED | 未修改权重表、阈值与 composite 计算；`constraint-density` 仍为 `weight=0` |

### Requirement: 信号进入 agent 契约面

| 约束 | 状态 | 证据 |
|------|------|------|
| SHALL `mumuspec metrics --json` 输出结构化字段（`metrics[]`、`suggestions[]`） | DONE | `--json` 分支输出可解析 JSON；ENF-5 测试断言字段完整 |
| SHALL AGENTS.md 速查含该入口，由命令注册表注入 | DONE | 重新生成 AGENTS.md，第 166 行含 `mumuspec metrics [change]`，条目源自 `renderCliCheatSheet(program)` 命令注册表 |
| SHALL NOT 在 AGENTS.md 中内联指标数据 | SATISFIED | 速查条目仅命令与描述，无指标数值；AGENTS.md 15,032 字节 < 32KiB 预算 |

### Requirement: 元数据事实源对齐

| 约束 | 状态 | 证据 |
|------|------|------|
| SHALL `docs/STATUS.md` 当前包版本与 `package.json` 一致 | DONE | STATUS.md 已更新为 0.21.0-alpha.0，与 `package.json` 一致；ENF-7 测试断言字符串相等 |
| SHALL `.mumuspec/config.yaml` 的 `ai.rules_files` 不含 `.cursorrules` / `.windsurfrules` | DONE | `rules_files` 现为 `CLAUDE.md` / `AGENTS.md`；ENF-8 测试断言无遗留目标 |
| SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净 | SATISFIED | 事实源（config.yaml）已清理为干净值，`src/rules/generator.ts` 的硬过滤保留为第二道防线而非唯一防线 |

## Enforcement 一览

| ID | 声明 | 落地测试 |
|----|------|---------|
| ENF-1 | enforced-strong | `tests/change/loop-evaluation-suggestions.test.ts` — 断言 `LoopEvaluation.suggestions` 非空且与输入一致 |
| ENF-2 | enforced-strong | 同上 — 断言 MetricsSnapshot 保留 suggestions；配置文件字节不变 |
| ENF-3 | enforced-strong | `tests/core/metrics/collect-metrics.test.ts` — 非 loop 变更下返回约束密度与一次通过率两项 |
| ENF-4 | enforced-strong | 同上 — 执行采集后变更 state 文件字节不变 |
| ENF-5 | enforced-strong | 同上 — `--json` 输出可解析且字段完整 |
| ENF-6 | enforced-weak | 实跑断言：AGENTS.md 速查含 `mumuspec metrics` 条目，全文 15,032 字节 ≤ 32KiB |
| ENF-7 | enforced-strong | `tests/core/consistency/metadata-alignment.test.ts` — STATUS.md 版本 = package.json version |
| ENF-8 | enforced-strong | 同上 — config.yaml `ai.rules_files` 不含遗留目标 |

## 实施变更清单

### 新建文件

- `src/cli/commands/metrics.ts` — 只读自由度度量报告命令
- `tests/change/loop-evaluation-suggestions.test.ts` — ENF-1/ENF-2
- `tests/core/metrics/collect-metrics.test.ts` — ENF-3/ENF-4/ENF-5
- `tests/core/consistency/metadata-alignment.test.ts` — ENF-7/ENF-8

### 修改文件

- `src/change/loop-engine.ts` — 转换层保留 `suggestions`，写入 `LoopEvaluation` 与 `MetricsSnapshot`
- `src/core/types-loop.ts` — `LoopEvaluation` 新增 `suggestions` 字段
- `src/core/metrics/types.ts` — `MetricsSnapshot` 新增 `suggestions` 字段
- `src/core/metrics/auto-evaluate.ts` — 拆出纯采集函数 `collectMetrics`（无 `recordProgress` 副作用）
- `src/core/metrics/constraint-density.ts` — 采集路径修复（见"实现期发现"）
- `src/cli/commands/loop.ts` — 建议打印段（标注须人工签收后生效）
- `src/cli/index.ts` — 注册 `metrics` 命令
- `src/cli/commands/.mumuspec/BOUNDARY.md` — 命令登记表补 `registerMetricsCommands`
- `tests/cli/commands/check-json.test.ts` — BOUNDARY 一致性计数同步
- `tests/core/metrics/constraint-density.test.ts` — 夹具改为多行 JSON（回归守卫）
- `AGENTS.md` — 重新生成，速查含 `metrics` 入口
- `docs/STATUS.md` — 版本对齐至 0.21.0-alpha.0
- `.mumuspec/config.yaml` — `version` 归正、`ai.rules_files` 清除遗留目标

## 实现期发现（超出 G1–G4 已签收范围，仅记录不处理）

1. **`constraint-density` 采集路径从未采到值。** 两处叠加缺陷：`spawnSync('npx', ...)` 在 win32 上 ENOENT；`context --json` 实际输出为多行美化 JSON，采集器只取首个以 `{` 开头的行。原单测的紧凑 JSON 夹具掩盖了第二处缺陷。已修复，与 ENF-3 直接相关（不修则 metrics 无法返回约束密度）。该项属已签收范围内的必要修复。
2. **`discard` 当前分支导致 HEAD 进入 unborn 状态。** 丢弃变更时若 HEAD 正指向被删除的变更分支，分支 ref 被移除而 HEAD 未回退，后续 `new` 在 unborn HEAD 上执行 `git checkout -b`，继承该状态。本次会话中已被触发并现场修复。属独立缺陷，未纳入本变更。
3. **`src/.mumuspec/changes/` 残留。** 上述 unborn 状态前的错误作用域创建/丢弃所留，mumuspec 管理的工件，未手工删除。

## 已知限制

- 全量回归中 `cli-smoke` 的 dogfooding 门槛测试因既有 59 条 E-GUARD-003 违规持续失败，需独立变更收敛该规则的判定精度（现为宽匹配，将 `existsSync('.mumuspec')` 一类模式全量判违）。
- `.cursorrules` 仍存在于仓库（提交于 master），事实源已停止生成该目标，但存量文件未删除——删除超出本变更签收范围，列为后续项。
