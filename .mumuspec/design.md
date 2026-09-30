---
layer: 0
scope: "."
last_updated: "2026-09-06"
---

# Root Technical Design

> 本文件满足 E-SPEC-006（有 spec.md 必须有 design.md）。根层设计的权威细节分布在
> `docs/design/` 各分层设计文档中，此处仅作索引与边界声明；两处不一致时以
> docs/design/ 为准并回改本索引。

## 分层设计索引

| 领域 | 权威文档 | 概述 |
|------|----------|------|
| 规范层（树状双约束、渐进披露） | `docs/design/spec-layer.md` | SHALL/SHALL NOT 三段式 + 双层约束体系 + Ponytail 阶梯 |
| 动态约束强度 | `docs/design/constraint-strength.md` | TD/RG 双维度 × high/medium/low；§9.0 可验证性前置判定（P0） |
| 变更层（生命周期状态机） | `docs/design/change-layer.md` | Open→Design→Build→Verify→Archive DCG + 回退环 |
| 守卫层（三级校验） | `docs/design/guard-layer.md` | Pre-commit (<5s) → CI (<5min) → Phase Guard (<30s) |
| 契约层 | `docs/design/contract-layer.md` | CONSUMES/EXPOSES + 漂移检测 |
| 知识层 | `docs/design/knowledge-layer.md` | Code Graph + LLM-Wiki + PageIndex |
| AI 集成 | `docs/design/ai-integration.md` | Skill 编排 / Rules 生成 / MCP / CLI / Git Hooks |
| 图表化呈现 | `docs/design/diagram-rendering.md` | 图数据 → 四视图确定性渲染 + 文档图示对账 |

## 关键技术决策

- **Verifier 语义（P0, 2026-08-29）**：约束可验证性四分类（enforced-strong /
  enforced-weak / manual / unverifiable），SHALL NOT 无验证通道恒 block
  （E-SPEC-015）；可验证性与强度正交（§9.0）。设计提案与实施记录见
  `review/proposal-verifier-semantics-2026-08-29.md`。
- **DSL 定位（2026-08-29）**：持久化 spec 是一门带 verifier 的领域特定语言（DSL），
  不是字节码式中间表示。决策页：knowledge/decisions/global/KP-0059。
- **行为/结果约束分离（CHG-5）**：结果可客观验证的约束才允许 block；过程约束
  一律 advisory，为 LLM 保留 HOW 层自由度。

## 文档体系职责矩阵（2026-09-06 整合）

docs/ 已纳入 mumuspec 文档体系，职责划分如下（唯一源原则，双源即冲突）：

| 区域 | 职责 | 权威性 |
|------|------|--------|
| `.mumuspec/spec.md` / `prohibitions.md` | 约束（SHALL / SHALL NOT） | 唯一源 |
| `.mumuspec/prd.md` / `goal.md` | 产品需求与北极星 | 唯一源 |
| `.mumuspec/tech.md` | 代码实现概览（六层模块、技术栈） | 唯一源 |
| `.mumuspec/design.md` | 设计索引 + 边界声明（本文件） | 索引，细节以下行为准 |
| `.mumuspec/glossary.md` | 权威术语表（Ubiquitous Language） | 唯一源；`docs/reference/glossary.md` 仅作对外快速入口，不得独立维护定义 |
| `.mumuspec/knowledge/` | WHY / WHERE 决策与模式页 | 知识层工具管理；KD/KP 页面为导入快照，与源文档冲突时以源文档为准 |
| `.mumuspec/roadmap/` / `contracts/` / `adr/` | 路线图、契约变更、架构决策记录 | 各自唯一源 |
| `docs/design/` | 分层设计权威文档（8 篇） | 设计细节唯一源 |
| `docs/overview.md` / `STATUS.md` | 对外总览 / 进度权威 | STATUS 为进度唯一权威 |
| `docs/getting-started*.md` | 用户教程（人类 / Agent） | 教程唯一源 |
| `docs/reference/` | 用户参考（CLI / MCP / config / error-codes 等） | 唯一源（error-codes.md 由代码自动生成） |
| `docs/appendix/` | 冻结研究报告（Level 3） | 快照性质，不再演进；知识层已有对应 KD/KP/KL 页 |
| `docs/standards/` | 对外标准化提案 | 提案性质，标注实现状态 |

## Enforcement

- ENF-1: manual(根层设计以 docs/design/ 分文档维护，本文件仅作索引；由 docs/
  目录变更时的 review 流程人工核对一致性)
