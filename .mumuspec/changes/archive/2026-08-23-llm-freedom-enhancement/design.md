# Design — LLM 自由度工作流增强 (R-0004)

> **变更名**: llm-freedom-enhancement
> **工作流**: full / phase: build
> **产出阶段**: Build (测试 + BP 注册 API)
> **参考**: roadmap/items/R-0004.md, .mumuspec/temp/designs-archive/llm-freedom-analysis.md

---

## API Contracts

### SHALL
- `estimateScope(params): ScopeEstimation` — 从原始信号计算 scope
- `deriveRiskTier(scope): RiskTier` — low/medium/high 分类
- `checkSafetyFence(scope): { blocks, triggers }` — 安全围栏检查
- `recommendPath(scope): PathRecommendation` — 返回推荐路径 + 置信度 + 理由
- `formatRecommendation(rec): string` — 格式化为 proposal.md 注入文本
- `registerBP(bp: BlockingPoint): void` — 运行时注册阻塞点
- `getBPRegistry(): ReadonlyMap<string, BlockingPoint>` — 获取注册表快照

### SHALL NOT
- 不修改 `recommendPath()` 的函数签名
- 不修改 `estimateScope()` 的函数签名

---

## Architecture Overview

```
Layer 0: workflow-recommender.ts (已有 ✅)
  ├─ estimateScope / deriveRiskTier / checkSafetyFence
  ├─ recommendPath / formatRecommendation
  └─ ← 新增: tests/core/workflow-recommender.test.ts

Layer 1: change.ts (已有 ✅)
  ├─ 行 78-135: CLI 集成逻辑
  └─ ← 新增: tests/cli/change-new-recommend.test.ts

Layer 2: bp-registry.ts (待建)
  ├─ registerBP / getBPRegistry / clearBPRegistry
  └─ ← 新增: tests/core/bp-registry.test.ts
```

---

## Data Flow

```
用户运行 `mumuspec new X --files 3 --bugfix`
    ↓
change.ts 解析 CLI 参数
    ↓ (hasScopeSignals = true)
    ↓
estimateScope() → ScopeEstimation { estimated_files: 3, is_pure_bugfix: true, risk_level: 'low' }
    ↓
recommendPath() → PathRecommendation { path: 'hotfix', confidence: 0.8, ... }
    ↓
formatRecommendation() → markdown 文本
    ↓
注入 proposal.md + 输出 "Recommended: hotfix (80% confidence)"
    ↓
saveChangeState() 持久化 scope signals
```

---

## Error Specification

| Condition | Behavior |
|-----------|----------|
| Resolver 函数抛出异常 | resolveBP 捕获并返回 resolved=false |
| 未注册的 BP ID | resolveBP 返回 null |
| 无 Resolver 的 BP | resolveBP 返回 null |
| 重复注册同 ID | 后注册覆盖前注册 |

---

## Constraints Analysis

### Performance
- BP Registry 在内存中，O(1) 读写
- 不影响现有 workflow.yaml 静态 BP 性能

### Testability
- 所有模块有独立测试
- beforeEach 清理状态

### Compatibility
- 新增 API 源码向后兼容
- 已有 CLI 行为无变化

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Test coverage inadequate | 64 tests across 3 test files |
| BP Registry 状态泄漏 | beforeEach 清理 registry |
| formatRecommendation 破坏性变更 | 测试用 contains() 而非 eq() |

---

## Test Strategy

### Layer 0: Unit Tests
- tests/core/workflow-recommender.test.ts (33 tests)
- tests/core/bp-registry.test.ts (23 tests)

### Layer 1: CLI Integration
- tests/cli/change-new-recommend.test.ts (8 tests)

### Acceptance
- All 64 tests pass
- npm run build clean
- Guard check passes

---

## Acceptance

- [x] All 64 tests pass
- [x] npm run build clean
- [ ] Guard check passes (pending artifacts)
