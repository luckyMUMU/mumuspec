---
scope: src/change
layer: 2
---

# Product Requirements: change

## 模块职责 (What this module does)

变更生命周期管理模块，负责创建、追踪、转换、回滚和归档变更。

- `createChange()` — 创建新变更，初始化状态机、工件目录结构、反馈目录
- `archiveChange()` — 归档变更，执行 delta-spec 合并、知识提取、版本 bump
- `discardChange()` — 丢弃变更，快照保存后移至 archive/discarded/
- `executeTransition()` / `executeRollback()` — 状态机驱动的前进/回滚
- `lockTestCases()` / `verifyTestCases()` — 测试用例锁定与 hash 校验
- `appendDecision()` — 决策日志按 phase 分类记录
- `appendFeedbackToChange()` — 反馈与变更的双向关联

## 存在理由 (Why it exists)

规范驱动的开发需要严格的变更追踪。每个变更必须经历 open → design → build → verify → archive
的完整生命周期，确保设计先行、测试锁定、知识沉淀。状态机防止非法跳转，回滚机制处理失败场景。

## 用户场景 (User scenarios)

1. **新功能开发**：`mumuspec new feature-x` 创建变更，走 full workflow 完整流程
2. **紧急修复**：`mumuspec new hotfix-y --workflow hotfix` 跳过 design，直接 build
3. **回滚**：build 阶段发现设计问题，rollback 回 design 重新设计
4. **归档**：变更完成验证后归档，自动提取知识页并 bump 版本号

## 验收标准 (Acceptance criteria)

- 变更创建时自动生成 proposal.md、delta-specs/、constraints/、test-cases/ 等目录结构
- 状态转换必须通过 `canTransition()` 校验，非法转换返回 E-CHANGE-006
- 回滚操作记录到 rollback_history，计数不超过 rollback_limit
- 归档时自动合并 delta-specs 到主 spec.md，提取知识页到全局知识库
- 归档时自动 bump 版本号（tweak/hotfix = patch, full = minor）
- 同一时间仅允许一个活跃变更（除非配置 single_active_change: false）
