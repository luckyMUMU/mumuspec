---
id: KE-eval-corpus-lessons
title: Lessons from eval-corpus decisions
type: lesson
status: confirmed
scope: eval-corpus
created_at: 2026-09-17
tags:
  - auto-extracted
  - lesson
  - decisions
  - eval-corpus
graph_bindings: []
---
> Auto-extracted from eval-corpus/decisions.md

# Decision Log: eval-corpus


## [open] 2026-09-14T14:24:24.762Z

BP-2 拆分判定：不拆分。M1 为单一批次能力（corpus 类型+语料库+2评估器+report 出口），M2/M3/M4 已在实施计划中各自独立成批，天然满足独立交付。

## [open] 2026-09-14T14:24:56.942Z

范围裁决（Round 1 Q&A，用户确认）：语料位置采用 .eval-corpus/ 隐藏目录（探测 4 实锤 tests/fixtures 被扫描）；custom 类型实现 assertions-only（消除死端）；checker 三盲区 B-1/B-2/fence-W 不入本变更挂 M2 评审；变更名 eval-corpus 经用户确认。

## [open] 2026-09-14T14:25:10.036Z

降级记录：brainstorming skill 不可用按 Fallback A 以 AskQuestion 两轮澄清；gitnexus-impact-analysis 不可用按 Fallback B 手动影响分析；using-git-worktrees 不可用且本会话 shell 无 git，保留 new 自带 branch 隔离。知识加载 0 页；契约 0 项全兼容；base_ref=23484ad；new 的 unborn-HEAD 怪癖复现已切回 master。

## [design] 2026-09-15T12:47:47.872Z

架构设计（高见远）：三层单向依赖 L0 runner（corpus.ts 纯函数 + runner 编排 + custom 修复）/ L1 评估器（verifiable-ratio + fail-open-count + auto-evaluate 注册）/ L2 消费层（eval --report 双形态 + .eval-corpus 语料 + fixture-location 断言）。关键决策 D-corpus-1 baseline 参照系多信号 diff（跨域探针自动降级纯码检测）/ D-corpus-2 noise 只计码不计 coverage 结构差异 / D-corpus-3 probe 白名单枚举防注入 / D-corpus-4 cwd 只接受绝对路径 / D-eval-1 fail-open-count 限计数+分组（4 类静默点位比对挂 M2）。Fallback F 五角度自审：hard_constraints 6 / decisions 7 / risks 7 / open_questions 0。

## [design] 2026-09-15T12:47:54.062Z

BP-7 用户裁决（2026-09-15）：① Hyperplan 门禁通过（open_questions=0，Fallback F 替代 5 成员对抗团队）；② 跨域码 fixture 范围——E-GUARD-010 与 E-CHANGE-022 各建 1 例（change-scoped fixture，接受成本）；③ M1 定位明示为建档非定标——每码 1 例（n<3）输出普遍标注「置信不足」属正常特征，非回归缺陷。认知框架收敛：Q1×8 / Q3×4 confirmed（含 grill-me GM-001 分层与 GM-002 expected.yaml 形态）/ Q4×3 盲区全部有兜底；build_layers 三层已入状态机。

## [design] 2026-09-15T13:23:16.441Z

测试用例设计（严过关）：三层 66 例（L0 32 / L1 18 / L2 16，P0 58），每例含 ID/目标（引用 design 章节+DS 条目+风险号）/前置/步骤/可断言期望/优先级/隔离方式；覆盖 DS-EVAL-001~004 与 R-1~R-7 全覆盖矩阵。BP-8 用户确认锁定。

## [design] 2026-09-15T13:23:17.627Z

BP-8 四项口径裁决：① corpusExpect M1 留空不设硬阈值（用户确认，n<3 高波动；report 仅展示 + 可选声明路径保留）；② 权重和断言用 toBeCloseTo(1.0,10) 不做实现侧归一化（既有 6 评估器浮点和 0.9999999999999999 为事实）；③ E-SPEC-015 severity 纳入 veto 档（与 forceable:false 一票否决红线一致）；④ L2-C07 位置隔离测试用临时重命名 + finally 复原。

## [build] 2026