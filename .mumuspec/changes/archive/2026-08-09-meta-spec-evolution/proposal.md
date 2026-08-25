# Proposal: Meta-Spec Evolution 框架（R-0005）

## 背景与目标

在 R-0002（自动化指标评估）和 R-0003（AST Guard）基础上，构建安全的元进化引擎。Goal：使 MumuSpec 能评估自身规范的有效性、提出改进建议，并在人机协同下安全进化。

**架构三原则：**
1. 分离进化对象与机制（规范 What / 执行 How 独立进化）
2. 经验验证替代形式证明（规范变更通过 Loop 指标验证）
3. 不可修改的外部锚定（核心 SHALL NOT 条目 Goal Preservation）

## 范围

### 包含
- Enforcement 条目有效性评分（通过率 vs 误报率，0.0-1.0）
- 低评分条目优化建议队列（score < 0.3 自动标记）
- `mumuspec meta-evolve` 命令（`--analyze` / `--propose` / `--apply`）
- `.mumuspec/contracts/meta-evolution/` 契约目录
- 知识层元进化 R0（freshness / PageIndex / 经验密度标签自动调整）
- Skill 推荐 R1（基于 scope 的 Skill 组合推荐）
- 影响分析 + 用户确认门（Guard 拦截未分析直接 apply）

### 不包含
- 无人确认的规范自主修改
- 跨代差异蒸馏（R4 长期）
- LLM 权重微调

## 影响分析

**涉及模块：**
- `src/guard/` — checker.ts、constraint-evaluator 集成
- `src/cli/commands/` — 新增 meta-evolve 命令
- `.mumuspec/contracts/` — 新增 meta-evolution/ 契约目录
- 知识层（PageIndex、freshness）— R0 子任务
- Skill 系统 — R1 子任务

**兼容性风险：**
- 低风险：新增命令，不破坏现有
- 中风险：知识层 freshness 调整影响缓存机制 → 需提供回滚
- 核心 SHALL NOT 条目不可修改 — Goal Preservation 锚定

**受影响的上游/下游：**
- 下游：mumuspec guard / check 命令集成评分数据
- 上游：R-0002 auto-evaluate、R-0003 AST provider

## 验收标准

| # | 条件 | 验证 |
|---|------|------|
| 1 | 约束条目包含 effectiveness_score | 至少 10 条 |
| 2 | score < 0.3 自动进优化队列 | 单元测试 |
| 3 | `--propose` 输出 markdown 提案 | CLI 集成测试 |
| 4 | 影响分析 + Guard 拦截 | 端到端测试 |
| 5 | 知识层 freshness 调整有效 | 集成测试 |
| 6 | Skill 推荐准确率 > 60% | 测试集 |
| 7 | 端到端 Meta 变更走通 | dogfooding |
| 8 | 核心 SHALL NOT 不可修改 | 单元测试 |

## 工作量

capacity_cost: 6（≈12-18 人天）

## 冲突与互斥

- mutex_with: R-0001（Graph 编排引擎）— Guard Layer 执行集成点可能因 R-0001 重构而偏移
- supersedes: R-0010

## 下一步

- 确认 proposal
- 进入 Design 阶段（design.md + 测试用例锁定）
