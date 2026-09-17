---
id: KE-eval-corpus-patterns
title: Architecture patterns from eval-corpus
type: pattern
status: confirmed
scope: eval-corpus
created_at: 2026-09-17
tags:
  - auto-extracted
  - pattern
  - architecture
  - eval-corpus
graph_bindings: []
---
> Auto-extracted from eval-corpus/design.md

# Design: eval-corpus — M1 评测基座

> 变更：eval-corpus ｜ 阶段：design ｜ 依赖：proposal / DS-EVAL-001~004 / cognitive-map / impact-analysis
> 设计依据：`review/evaluation-metrics-implementation-plan-2026-09-13.md`（M1 表）、`review/evaluation-metrics-probe-results-2026-09-13.md`（多信号 kill 口径与语料位置一手证据）
> 参考实现（复用既有模式，不自建第二通道）：`src/eval/runner.ts`、`src/cli/commands/eval.ts`、`src/core/metrics/{types,evaluator-registry,drift-score,spec-compliance,design-build-first-pass,constraint-density,auto-evaluate}.ts`
> 格式基准：`.mumuspec/changes/archive/2026-09-13-bp-into-graph/design.md`

---

## 0. 设计约束（硬红线，来自提案 + 用户裁决）

| # | 约束 | 落点 |
|---|---|---|
| C-1 | 新评估器一律 `weight=0` 注册；loop composite 权重和不变（1.0）、阈值 0.85、稳定窗口 3 轮均不动 | §2.2 |
| C-2 | 不引入新依赖（Ponytail L3-L5），复用既有工具/模式 | 全篇 |
| C-3 | 不改变 `check` / `validate` 命令的既有 JSON schema；评估器只读消费 | §2.2 |
| C-4 | 语料放 `.eval-corpus/` 隐藏目录（`findSpecDirs` 天然跳过 `name.startsWith('.')`）；`eval --report` 仅 stdout（不落盘） | §2.3 |
| C-5 | corpus kill 判定必须多信号 diff：新增错误/警告码 ∪ coverage 五字段（total/enforced_strong/enforced_weak/manual/unverifiable）任一变化 | §2.1.3 |
| C-6 | `EvalReport` 只新增维度（`corpusReports`），既有 `total/passed/failed` 语义不变 | §2.1.1 |
| C-7 | 依赖方向 report → evaluators → runner 单向；三层 L0/L1/L2（GM-001 已确认） | §2.0 |

---

## 1. 高层设计（L2 消费层视角）

### 1.1 `eval --report` 输入输出契约

`--report` 是 `eval run` 子命令上的**新增布尔旗标**，纯增量、不改变既有 `run` 行为：

- 输入：无（复用 `run` 已解析的 workspace）；`--json` 与之组合决定形态。
- 输出（**仅 stdout，不落盘**，Q1-007 / TEMP-4 红线）：
  - 文本形态：四段可读汇总 —— ① 各 corpus 场景 recall/noise + Wilson 95% CI（`n<3` 标注「置信不足」）；② A1 可验证率（strong_ratio + 四分类计数）；③ B4 fail-open 计数（按 action 分组 + 清单）；④ 测试覆盖率引用（B6 阈值 + 采集命令）。
  - JSON 形态（`--report --json`）：冻结为 `EvalSummaryReport`（§2.3.1），含 `version: 1` 字段。
- 退出码：**不改既有语义** —— `run` 的 exit code 仍由 `report.failed` 决定；corpus 场景自身的 `corpusExpect` 断言失败会体现为该场景 `passed=false`，从而计入 `failed`。

### 1.2 corpus 场景的用户可见语义

用户在 `.mumuspec/evals/<name>.yaml` 声明一条 corpus 场景：

```yaml
name: eval-corpus-b1
type: corpus
corpusDir: .eval-corpus          # 相对项目根；缺省即 .eval-co