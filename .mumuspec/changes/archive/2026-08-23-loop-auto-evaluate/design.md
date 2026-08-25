# Design: loop-auto-evaluate (R-0002)

## 概述

在现有 Loop Engine 上增加**自动化指标驱动收敛判断**能力，新增 `auto-evaluate` 和 `hybrid-evaluate` 两种模式，替代完全依赖人工输入 `progress` 和 `goal_achieved` 的现状。

## 架构设计

### 核心接口

```typescript
// src/core/metrics/types.ts
export interface EvaluatorContext {
  projectRoot: string;
  changeName: string;
  worktreePath?: string;
  previousRound?: number;
  roundHistory: LoopRound[];
}

export interface MetricResult {
  name: string;          // 'test-pass-rate' | 'drift-score' | 'spec-compliance' | 'code-delta'
  value: number;         // [0, 1]
  weight: number;        // 各指标在总进度中的权重
  details: string;       // 人类可读的详情
  rawData?: unknown;     // 原始数据（用于 HTML 报告）
}

export interface Evaluator {
  readonly name: string;
  readonly defaultWeight: number;
  evaluate(ctx: EvaluatorContext): Promise<MetricResult>;
}

export interface AutoEvaluateResult {
  progress: number;           // 加权综合进度 [0, 1]
  goalAchieved: boolean;      // 是否达到收敛条件
  metrics: MetricResult[];    // 各指标详情
  recommendation: string;     // 下一轮建议
}
```

### 四种指标采集器

| Evaluator | 权重 | 数据源 | 说明 |
|-----------|------|--------|------|
| `TestPassRateEvaluator` | 0.35 | `vitest run --reporter=json` | 测试通过率 |
| `DriftScoreEvaluator` | 0.25 | AST Guard 语义约束检测（R-0003） | 规范漂移分数 |
| `SpecComplianceEvaluator` | 0.25 | constraint 验证 | SHALL/SHALL NOT 合规率 |
| `CodeDeltaEvaluator` | 0.15 | git diff 统计 | 代码变更收敛度 |

### 收敛判断算法

```typescript
function shouldConverge(result: AutoEvaluateResult, config: ConvergenceConfig): boolean {
  // 连续 N 轮达标才算收敛（避免噪声误判）
  if (result.progress < config.threshold) return false;
  if (result.metrics.some(m => m.value < m.minAcceptable)) return false;
  return isStableConvergence(result.history, config.stabilityWindow);
}
```

## API 契约

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/core/metrics/types.ts` | Evaluator 接口、MetricResult、AutoEvaluateResult |
| `src/core/metrics/evaluator-registry.ts` | Evaluator 注册中心 |
| `src/core/metrics/test-pass-rate.ts` | 测试通过率采集器 |
| `src/core/metrics/drift-score.ts` | 基于 AST Guard 的漂移分数 |
| `src/core/metrics/spec-compliance.ts` | 规范合规率采集器 |
| `src/core/metrics/code-delta.ts` | 代码变更比率采集器 |
| `src/core/metrics/html-reporter.ts` | HTML 报告生成器 |
| `src/core/metrics/index.ts` | 统一导出 |

### 修改文件

| 文件 | 修改点 |
|------|--------|
| `src/core/loop-engine.ts` | `evaluateRound()` 增加 `autoEvaluate` / `hybridEvaluate` 分支 |
| `src/core/types-loop.ts` | LoopInitInput 增加 `evaluate_mode` 字段；LoopState 增加 `metrics_history` |
| `src/cli/commands/loop.ts` | `evaluate` 子命令增加 `--auto` 和 `--hybrid` flag |

## 数据流

```
用户执行 evaluate --auto
       ↓
autoEvaluate(ctx)
       ↓
并行执行 4 个 Evaluator
       ↓
加权计算 progress = Σ(value × weight)
       ↓
检查收敛条件 (progress >= threshold + 连续 N 轮 + 各指标 >= min)
       ↓
返回 { progress, goalAchieved, metrics, recommendation }
       ↓
loop-engine 按原有逻辑处理 (converged/plan/exhausted)
```

## Error Specification

| 场景 | 处理方式 | 错误消息 |
|------|---------|---------|
| 某个 Evaluator 采集失败 | 跳过该指标，权重按比例分配给其他指标 | Warn: "test-pass-rate failed, redistributing weight" |
| 全部 Evaluator 失败 | 回退到人工评估 | Error: "All auto-evaluators failed, please use manual evaluate" |
| vitest 未安装 | TestPassRateEvaluator 返回 null | Debug: "vitest not available, skipping" |
| Worktree 路径不存在 | 使用 projectRoot | Info: "Worktree unavailable, using project root" |

## 实现层级

| 层级 | 组件 | 职责 |
|------|------|------|
| L1 接口 | `types.ts` | 类型定义 |
| L2 注册 | `evaluator-registry.ts` | Evaluator 注册/查找 |
| L3 采集 | 4 个 `*evaluator.ts` | 指标计算 |
| L4 编排 | `auto-evaluate.ts` | 加权 + 收敛判断 + 历史追踪 |
| L5 报告 | `html-reporter.ts` | HTML 可视化 |
| L6 集成 | `loop-engine.ts` | 接入 evaluateRound |

## Constraints (Ponytail)

### SHALL
- SHALL: auto-evaluate 失败时 graceful 降级到 manual evaluate
- SHALL: 单个 Evaluator 权重动态调整（某指标不可用时权重均分）
- SHALL: 收敛必须满足 "连续 N 轮" 条件（避免噪声误判）

### SHALL NOT
- SHALL NOT 新增外部依赖（用 spawnSync 调用 git + vitest，不引入 npm 包）
- SHALL NOT 删除或修改现有的 manual evaluate 路径
- SHALL NOT 改变 LoopState 的持久化结构（仅追加新字段）

## Test Strategy

### 单元测试 (`tests/core/metrics/`)
- Evaluator 接口符合性
- 每个 Evaluator 的计算逻辑
- 权重动态调整算法
- 收敛判断算法（含边界条件）
- HTML 报告生成

### 集成测试
- evaluateRound 中 auto/hybrid 分支端到端
- 与 detectStagnation 联动

### 测试覆盖目标: ≥ 8 个测试用例

## 进度计划 (tasks.md)

- T-001: 创建 `src/core/metrics/types.ts` — Evaluator 接口 + 类型定义
- T-002: 创建 `src/core/metrics/evaluator-registry.ts` — 注册中心
- T-003: 实现 4 个 Evaluator (test-pass-rate, drift-score, spec-compliance, code-delta)
- T-004: 实现 `auto-evaluate.ts` — 加权编排 + 收敛判断
- T-005: 修改 `loop-engine.ts` — 集成 auto/hybrid 分支
- T-006: 修改 `types-loop.ts` — 增加 evaluate_mode 字段
- T-007: 修改 `loop.ts` CLI — 增加 --auto / --hybrid flag
- T-008: 实现 `html-reporter.ts` — HTML 报告生成
- T-009: 编写测试用例 (≥ 8 个)
- T-010: 运行 guard + 修复问题 + 归档

---

> 关联: depends_on [R-0003 ✅] | supersedes R-0007 | capacity_cost: 5
