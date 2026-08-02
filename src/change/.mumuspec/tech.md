---
scope: src/change
layer: 2
---

# Technical Design: change

## SHALL constraints (migrated from spec.md)

- 状态转换必须通过状态机验证（canTransition）
- 回滚操作必须记录到 rollback_history
- 变更创建时必须初始化 build_layers 和 test_cases
- 归档操作必须将变更从 active 移到 archive 目录
- 决策日志必须支持按 phase 分类记录

## SHALL NOT constraints (migrated from spec.md)

- 禁止绕过状态机直接修改 phase（必须通过 executeTransition）
- 禁止回滚次数超过 rollback_limit
- 禁止在 terminal 状态（archive-completed/discarded）继续转换
- 禁止创建同名活跃变更

## Enforcement (migrated from spec.md)

- CHANGE-1: 检查状态转换符合状态机规则
- CHANGE-2: 检查回滚不超限制
- CHANGE-3: 检查 single_active_change 不冲突

## 架构决策 (Architecture decisions)

- **状态机分离**：`state-machine.ts` 为纯函数模块（canTransition/executeTransition），`manager.ts` 处理 I/O
- **Blocking Points**：关键转换（open→design, design→build, verify→archive）需要用户确认（BP-3/BP-4/BP-17）
- **三种 Workflow**：full（完整五阶段）、hotfix（跳过 design）、tweak（最轻量，跳过 delta-spec 和知识提取）
- **版本自动 Bump**：归档时根据 workflow 类型自动递增版本号，同步更新 package.json 和 src/cli.ts
- **知识提取（D1-D8）**：归档时从 cognitive-map、decisions.md、design.md、hyperplan_result 自动提取知识页

## 接口契约 (Interface contracts)

```typescript
// state-machine.ts — 纯函数，无 I/O
function canTransition(from: ChangePhase, to: ChangePhase): boolean;
function executeTransition(state: ChangeState, to: ChangePhase, options?: {...}): {...};
function canRollback(state: ChangeState, rollbackType: string): GuardResult;
function executeRollback(state: ChangeState, rollbackType: string, reason: string): {...};
function requiresUserConfirmation(from: ChangePhase, to: ChangePhase): {...};

// manager.ts — I/O 层
function createChange(projectRoot, name, workflow, config, scopes): ChangeState;
function archiveChange(projectRoot, changeName): void;
function lockTestCases(projectRoot, changeName): string;
function appendDecision(projectRoot, changeName, phase, decision): void;
```

## 依赖关系 (Dependencies)

- **上游**：`src/core/types.js`（ChangeState/ChangePhase 类型）、`src/core/config.js`、`src/core/utils.js`、`src/core/errors.js`
- **跨模块**：`src/feedback/manager.js`（反馈结构初始化）、`src/knowledge/manager.js`（归档时知识提取）
- **下游**：被 `src/cli/commands/change.ts`、`src/cli/commands/state.ts`、`src/guard/phase-guard.ts` 调用
