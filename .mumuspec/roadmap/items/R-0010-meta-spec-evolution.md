---
id: "R-0010"
title: "Meta-Spec Evolution 框架：安全自进化引擎"
status: planning
priority: P1
scope: "src/core/guard, src/cli/commands, .mumuspec/contracts"
created_at: "2026-08-06"
target_date: "2026-12-31"
owner: ""
depends_on: ["R-0007", "R-0008"]
mutex_with: ["R-0008"]
excludes: []
capacity_cost: 6
---

# R-0010: Meta-Spec Evolution 框架

## 背景

> 调研发现 2026 年元进化（Meta-evolution）是 AI 编程的下一个范式转移。
> Gödel Machine（2003）→ DGM（ICLR 2026，SWE-bench 20%→50%）→ HyperAgents（Meta AI）→ AGP Autogenesis，
> 元进化已从理论走向工程实践。
> MumuSpec 的 self-improve-loop 变更证明了"用自身工具改进自身规范"的可行性，
> 当前需将此实践固化为正式的 Meta-Spec Evolution 能力，成为首个具备"安全自进化"的框架。
> 调研建议的 3 个架构原则：分离进化对象与机制、经验验证替代形式证明、不可修改的外部锚定。

## 范围

### 包含（Includes）
- Guard Layer Enforcement 条目的有效性评分算法（通过率 vs 误报率）
- 低评分 Enforcement 条目的自动检测和优化建议队列
- `mumuspec meta-evolve` 命令——对规范体系发起改进提案
- `.mumuspec/contracts/meta-evolution/` 子目录定义元进化操作契约（AGP RSPL/SEPL 对齐）
- 所有 Meta 变更强制执行完整的影响分析 + 用户征询流程（Goal Preservation 保障）
- 知识层元进化（R0）：自动调整 freshness、PageIndex、经验密度标签
- Skill 效能驱动的自动推荐（R1）：基于 scope 的 Skill 组合推荐

### 不包含（Excludes）
- 规范的自主无人确认修改（坚持人工确认门）
- 跨代差异蒸馏（R4，长期愿景留作后续）
- LLM 权重微调（不改变底层模型）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | Enforcement 条目包含 `effectiveness_score` 字段 | 至少 5 条约束有有效评分 |
| 2 | 低评分条目自动进入优化建议队列 | 低于阈值自动标记 + 报告输出 |
| 3 | `mumuspec meta-evolve --propose` 生成规范改进提案 | CLI 输出提案 markdown |
| 4 | Meta 变更被强制要求影响分析和用户确认 | Guard Layer 拦截未分析直接 apply |
| 5 | 知识层 freshness 自动调整 | 引用后自动提升 freshness 评分 |
| 6 | 基于 scope 的 Skill 推荐准确率 > 60% | 测试集评估 |
| 7 | 至少一个端到端 Meta 变更完整走通 | self-improve-loop 式 dogfooding |

## 工作量预估

`capacity_cost`: 6（≈ 12-18 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| Enforcement 有效性评分 | 3 |
| 知识层元进化（R0） | 3 |
| Skill 推荐引擎（R1） | 3 |
| `meta-evolve` 命令 + 契约层 | 4 |
| 影响分析 + 用户确认门 | 3 |
| 测试 + 文档 | 4 |

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 元进化导致意外规范退化 | 中 | 高 | 强制回滚能力 + 外部锚定 |
| 有效性评分数据不足（冷启动） | 高 | 中 | 初始基于人工标注 + 渐进自动化 |
| Goal Preservation 失效 | 低 | 极高 | 核心 SHALL NOT 条目不可被 meta-evolve 修改 |
| 社区对"自进化"概念的不信任 | 中 | 中 | 透明审计日志 + 可选禁用 |

## 互斥理由（Mutex Rationale）

- `R-0008`（AST-based Guard）：Guard Layer 实现升级与 Meta-Spec Evolution 规范体系改造同时变更会产生叠加震荡。建议先完成 AST 升级（R-0008），再做元进化框架（R-0010）。

---

> **关联**: depends_on [R-0007, R-0008] | mutex_with [R-0008] | excludes [无人确认修改, 模型微调]
