---
scope: src/guard
layer: 2
---

# Technical Design: guard

## SHALL constraints (migrated from spec.md)

- 合规检查必须覆盖 SHALL、SHALL NOT、Ponytail 三类约束
- 漂移检测必须对比 spec.md 与代码实现
- 阶段门禁必须验证前置条件（文件存在性、hash 一致性）
- 强度降级必须遵循 STRENGTH_ACTION_MAP 映射

## SHALL NOT constraints (migrated from spec.md)

- 禁止在 always_enforce 异常上应用强度降级
- 禁止门禁检查跳过用户确认（bp_03/bp_04/bp_17）
- 禁止合规检查忽略 SHALL NOT 违规

## Enforcement (migrated from spec.md)

- GUARD-1: 检查 SHALL NOT 违规返回 ERROR
- GUARD-2: 检查 always_enforce 异常始终阻断
- GUARD-3: 检查门禁条件满足才允许转换

## 架构决策 (Architecture decisions)

- **错误码元数据映射**：GUARD_CHECK_METADATA 将错误码映射到 dimension/min_strength/always_enforce
- **三段式求值**：exception → override → strength（block/warn/info），由 constraint-evaluator 执行
- **Phase Guard 模式**：每个转换定义前置条件（proposal.md 存在、test cases 锁定等）
- **Design Schema**：从 `templates/design-schema.yaml` 加载设计文档必需 section 模式
- **强度降级行为**：block → 保留 errors；warn → 移至 warnings；info → 丢弃

## 接口契约 (Interface contracts)

```typescript
// checker.ts
function checkCompliance(projectRoot: string, config: MumuSpecConfig, options?: {...}): GuardResult;
function detectDrift(projectRoot: string, config: MumuSpecConfig): DriftResult;
function applyStrengthToGuardResult(result: GuardResult, strength?: ConstraintStrengthField): GuardResult;

// phase-guard.ts
function runPhaseGuard(projectRoot: string, changeName: string, targetPhase: string, options?: {...}): GuardResult;
```

## 依赖关系 (Dependencies)

- **上游**：`src/spec/parser.js`（解析 spec.md）、`src/spec/ponytail.js`（Ponytail 标记）
- **跨模块**：`src/change/manager.js`（加载变更状态、验证测试用例）、`src/core/constraint-evaluator.js`（强度求值）
- **下游**：被 `src/cli/commands/guard.ts`、`src/eval/runner.ts`、`src/hooks/guard.ts` 调用
