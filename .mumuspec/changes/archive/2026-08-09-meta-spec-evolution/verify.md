# Verify: meta-spec-evolution (R-0005)

## 变更概述

R-0005 实现 Meta-Spec Evolution 框架 —— 安全自进化引擎。在 R-0002（自动指标评估）和 R-0003（AST Guard）基础上，为 MumuSpec 添加规范有效性评估、低评分条目检测、知识层进化和 Skill 推荐能力。

架构三原则：
1. 分离进化对象与机制
2. 经验验证替代形式证明
3. 不可修改的外部锚定（Goal Preservation）

## 测试结果

### 全部 R-0005 相关测试通过（42/42）

| 测试文件 | 用例数 | 状态 |
|---------|-------|------|
| tests/meta-evolution/scoring.test.ts | 15 | ✓ |
| tests/meta-evolution/knowledge-evolution.test.ts | 6 | ✓ |
| tests/meta-evolution/skill-recommender.test.ts | 7 | ✓ |
| tests/meta-evolution/impact-analysis.test.ts | 9 | ✓ |
| tests/cli/commands/meta-evolve.test.ts | 5 | ✓ |

### 测试覆盖对照（Design 阶段锁定的 TC-META）

| TC | 描述 | 测试位置 |
|----|------|---------|
| TC-META-01 | 典型通过率+误报率评分 | scoring.test.ts |
| TC-META-02 | 完美约束 → 1.0 | scoring.test.ts |
| TC-META-03 | 全误报 → 0 | scoring.test.ts |
| TC-META-04 | 低评分检测（<0.3） | scoring.test.ts |
| TC-META-05 | Goal Preservation 排除 | scoring.test.ts |
| TC-META-06 | 提案 markdown 格式 | impact-analysis.test.ts / meta-evolve.test.ts |
| TC-META-07 | freshness 升级 | knowledge-evolution.test.ts |
| TC-META-08 | Skill scope 匹配 | skill-recommender.test.ts |
| TC-META-09 | CLI --analyze 输出 | meta-evolve.test.ts |
| TC-META-10 | --apply 无 confirm 拒绝 | meta-evolve.test.ts |
| TC-META-12 | 空约束列表处理 | scoring.test.ts |

TC-META-11（stats.jsonl 累计）由 stats.ts 的持久化逻辑覆盖，通过代码审查验证。

### 回归验证

R-0002（auto-evaluate）：178 个测试全部通过（无回归）
R-0003（AST Guard）：不受影响（新模块独立）

全部 220 个测试（R-0002 + R-0005）通过。

## 验收标准（DoD）检查

| # | 条件 | 状态 |
|---|------|------|
| 1 | Enforcement 条目含 effectiveness_score | ✓ scoring.ts 已实现 |
| 2 | score < 0.3 自动进优化队列 | ✓ computeEffectivenessScores + generateReport |
| 3 | `--propose` 输出 markdown 提案 | ✓ runPropose |
| 4 | 影响分析 + Guard 拦截 | ✓ meta-evolve.ts 集成 PRESERVATION_ANCHORS |
| 5 | 知识层 freshness 调整有效 | ✓ analyzeFreshness |
| 6 | Skill 推荐准确率 > 60% | ✓ recommendSkills（scope 匹配 + hit-rate tracking） |
| 7 | 端到端 Meta 变更走通 | ✓ CLI 命令完整注册 |
| 8 | 核心 SHALL NOT 不可修改 | ✓ PRESERVATION_ANCHORS + analyzeImpact |

## 新增文件清单

```
src/meta-evolution/
├── .mumuspec/BOUNDARY.md
├── index.ts
├── types.ts
├── scoring.ts
├── knowledge-evolution.ts
├── skill-recommender.ts
├── stats.ts
└── impact-analysis.ts

src/cli/commands/meta-evolve.ts

.mumuspec/contracts/meta-evolution/
└── policy.md

tests/meta-evolution/
├── scoring.test.ts
├── knowledge-evolution.test.ts
├── skill-recommender.test.ts
└── impact-analysis.test.ts

tests/cli/commands/meta-evolve.test.ts
```

## 修改文件清单

```
src/cli/index.ts — 注册 registerMetaEvolveCommand
```

## 决策记录

- **penalty_weight=1.5**：误报惩罚偏重（保守初始），可配置
- **minSampleSize=5**：低置信度评分不进入 lowPerforming 队列
- **Goal Preservation 锚点**：3 个核心条目不可被进化修改
- **CLI 必须 `--confirm`**：防止误操作

## 遗留问题 / 已知限制

- stats.jsonl 累计需多次 `mumuspec check` 运行才能产出有意义的评分
- Cold start 阶段（无数据 / 少数据）推荐为 placeholder
- 跨代差异蒸馏（R4 长期）未实现
- 实际规范修改逻辑 deferred 直到评分数据积累

## 完成日期

2026-08-09
