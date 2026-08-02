---
scope: src/guard
layer: 2
---

# Product Requirements: guard

## 模块职责 (What this module does)

合规检查与阶段门禁模块，确保变更满足约束后才允许推进。

- **checker.ts** — 合规检查（checkCompliance）和漂移检测（detectDrift）
- **phase-guard.ts** — 阶段门禁（runPhaseGuard），验证前置条件后才允许状态转换
- 强度感知评估（applyStrengthToGuardResult）：根据 constraint_strength 配置降级或阻断
- 覆盖三类约束：SHALL、SHALL NOT、Ponytail

## 存在理由 (Why it exists)

规范如果不强制执行就只是一纸空文。guard 模块是 MumuSpec 的执行层，
确保每个阶段的产出物符合规范要求，防止跳过设计、测试未锁定等违规行为。
强度感知机制允许项目在严格度和灵活性之间平衡。

## 用户场景 (User scenarios)

1. **阶段转换门禁**：`mumuspec guard <change> <phase>` 检查是否满足转换条件
2. **合规检查**：`mumuspec check` 全量检查项目中的 SHALL/SHALL NOT 违规
3. **漂移检测**：`mumuspec drift` 对比 spec.md 与代码实现的一致性
4. **强度降级**：低强度配置下，部分检查降级为 WARN 而非阻断

## 验收标准 (Acceptance criteria)

- SHALL NOT 违规返回 ERROR（always_enforce 异常始终阻断）
- 漂移检测对比 spec.md 约束与代码实现
- 阶段门禁验证前置条件（文件存在性、hash 一致性）
- 强度降级遵循 STRENGTH_ACTION_MAP 映射
- 门禁检查不跳过用户确认（BP-3/BP-4/BP-17）
