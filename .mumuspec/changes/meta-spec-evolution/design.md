# Design: Meta-Spec Evolution 框架（R-0005）

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    mumuspec meta-evolve                         │
│  ┌──────────┐   ┌───────────┐   ┌──────────────┐              │
│  │--analyze │   │ --propose │   │   --apply    │              │
│  └────┬─────┘   └─────┬─────┘   └──────┬───────┘              │
│       │               │                │                        │
│  ┌────▼───────────────▼────────────────▼───────┐               │
│  │         Effectiveness Scoring Engine         │               │
│  │   (pass_rate × (1 - false_positive_rate))    │               │
│  └──────────────────┬──────────────────────────┘               │
│                     │                                           │
│  ┌──────────────────▼──────────────────────────┐               │
│  │     Knowledge  Layer (R0) / Skill (R1)       │               │
│  │   freshness tuning · PageIndex · scope match  │               │
│  └──────────────────┬──────────────────────────┘               │
│                     │                                           │
│  ┌──────────────────▼──────────────────────────┐               │
│  │       Impact Analysis + User Confirmation    │               │
│  │   (Goal Preservation · SHALL NOT anchor)     │               │
│  └─────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## 模块设计

### 模块 1: Effectiveness Scoring Engine

**文件：**
- `src/meta-evolution/scoring.ts` — 核心评分算法
- `src/meta-evolution/types.ts` — 类型定义
- `tests/meta-evolution/scoring.test.ts`

**数据模型：**
```typescript
interface EffectivenessScore {
  constraintId: string;
  passRate: number;        // [0,1] — 通过次数 / 总检查次数
  falsePositiveRate: number; // [0,1] — 误报次数 / 失败次数
  score: number;           // passRate × (1 - falsePositiveRate)
  lastEvaluated: string;   // ISO 8601
  sampleSize: number;      // 样本量（用于置信度判断）
}

interface EvolutionReport {
  generatedAt: string;
  scores: EffectivenessScore[];
  lowPerformingIds: string[]; // score < 0.3
  recommendations: string[];
}
```

**评分算法：**
```
score = passRate × (1 - falsePositiveRate × penalty_weight)
```
其中 penalty_weight 默认为 1.5（误报的负面影响比漏报更严重）。

**统计来源：**
- 每次 `mumuspec check` 结果记录到 `.mumuspec/evolution/stats.jsonl`
- 累计窗口：最近 N 次（默认 20 次）

**Goal Preservation：**
- 标记 `always_enforce: true` 的条目（如 E-GUARD-003 SHALL NOT 条目）不参与评分，且 `--apply` 时拒绝修改它们

---

### 模块 2: Knowledge Layer Meta-Evolution (R0)

**文件：**
- `src/meta-evolution/knowledge-evolution.ts`
- `tests/meta-evolution/knowledge-evolution.test.ts`

**机制：**
- freshness 自动调整：频繁引用的 page → freshness=active；长期未引用 → freshness=aging → stale
- PageIndex 自身质量评分：索引条目的准确性追踪
- 经验密度标签：基于引用频率动态调整权重

**数据模型：**
```typescript
interface KnowledgeEvolutionAction {
  pageId: string;
  action: 'promote_freshness' | 'demote_freshness' | 'refresh_page_index';
  reason: string;
  previousValue: string;
  newValue: string;
}
```

---

### 模块 3: Skill Recommendation Engine (R1)

**文件：**
- `src/meta-evolution/skill-recommender.ts`
- `tests/meta-evolution/skill-recommender.test.ts`

**机制：**
- 基于当前 scope（guard 失败的约束类型 + 文件扩展名）匹配可用 skill
- 记录推荐命中率（采纳 / 忽略），计算准确率
- 阈值 60% 以上才显示推荐

---

### 模块 4: `meta-evolve` CLI 命令

**文件：**
- `src/cli/commands/meta-evolve.ts` — Commander 命令注册
- `src/meta-evolve/index.ts` — barrel re-export
- `tests/cli/commands/meta-evolve.test.ts`

**子命令：**
```bash
mumuspec meta-evolve --analyze            # 输出当前 effectiveness score 报告
mumuspec meta-evolve --propose            # 生成优化提案（markdown）
mumuspec meta-evolve --apply --confirm    # 安全应用已确认的提案
```

**契约层：**
- `.mumuspec/contracts/meta-evolution/schema.json` — 评分数据 schema
- `.mumuspec/contracts/meta-evolution/policy.md` — 进化策略（保守 vs 激进）

---

### 模块 5: 影响分析 + 用户确认门

**机制：**
- `--apply` 必须经过影响分析（列出将被修改的文件/约束条目）
- 核心 SHALL NOT 条目在分析阶段即被过滤（Goal Preservation）
- 分析结果展示后，`--confirm` 才执行
- 所有 apply 操作记录到 decisions.md 审计日志

---

## 类型增强（extensions to existing types）

`ConstraintEntry` 增加可选字段：
```typescript
interface ConstraintEntry {
  // ... existing fields ...
  effectiveness_score?: number;  // [0,1], populated by meta-evolve
  stats_window?: number;         // sample size for score calculation
}
```

---

## 测试用例锁定（Red → Green TDD）

### TC-META-01: EffectivenessScore 计算
- 输入: passRate=0.8, falsePositiveRate=0.1
- 期望: score = 0.8 × (1 - 0.1 × 1.5) = 0.68

### TC-META-02: 完美约束
- 输入: passRate=1.0, falsePositiveRate=0
- 期望: score = 1.0

### TC-META-03: 全误报
- 输入: passRate=0.5, falsePositiveRate=1.0
- 期望: score = 0.5 × (1 - 1.5) = 0 (clamped to [0,1])

### TC-META-04: 低评分检测
- 阈值: 0.3
- 输入: score=0.25 的约束
- 期望: 进入 lowPerformingIds 数组

### TC-META-05: Goal Preservation
- 输入: always_enforce=true 的约束条目
- 期望: scoring 不含该条目；apply 拒绝修改

### TC-META-06: 提案生成格式
- 输入: 包含低评分条目的 report
- 期望: 输出 valid markdown 含问题描述 + 建议

### TC-META-07: freshness 升级
- 输入: 被频繁引用的 page
- 期望: promote_freshness 动作被记录

### TC-META-08: Skill scope 匹配
- 输入: guard 失败类型为 technical_design 的项目
- 期望: 返回匹配的 skill 推荐列表

### TC-META-09: CLI --analyze 输出
- 期望: 包含 Effectiveness Score 报告标题

### TC-META-10: CLI --apply 无 confirm 拒绝
- 期望: 输出提示需要 --confirm 标志，不执行修改

### TC-META-11: stats.jsonl 累计
- 执行 3 次 check
- 期望: stats.jsonl 累计记录 3 条

### TC-META-12: 空约束列表处理
- 输入: 无约束条目
- 期望: 返回空 report，不报错

---

## 边界约束与不变量

1. **Goal Preservation**: `always_enforce: true` 条目不可被进化修改
2. **经验锚定**: 所有 apply 操作必须可审计（decisions.md 记录）
3. **保守初始**: penalty_weight=1.5 误报惩罚偏重
4. **渐进式**: sampleSize < 5 的条目评分标记为 "low_confidence"，不进入 lowPerforming 队列
