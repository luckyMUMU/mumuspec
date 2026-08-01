# Test Cases: Layer 0 — Core Infrastructure

## TC-001: Design Schema Validation
- **Given**: design.md 缺少 "API Contracts" section
- **When**: 运行 guard --apply checkDesignToBuild
- **Then**: 返回 E-DESIGN-009，message 包含 "API Contracts"

## TC-002: Tweak Preset Lightweight Template
- **Given**: workflow=tweak 的变更
- **When**: 运行 guard --apply checkDesignToBuild
- **Then**: 仅检查 Architecture、Layers、Test Strategy 三个字段

## TC-003: Clarify Command Execution
- **Given**: 存在活跃变更 enhance-design-phase
- **When**: 运行 `mumuspec clarify enhance-design-phase`
- **Then**: 生成 clarification-log.md，包含识别的模糊点

## TC-004: AI Self-Review Critical Detection
- **Given**: design.md 缺少某个 FR 的覆盖
- **When**: 运行 `mumuspec review enhance-design-phase`
- **Then**: design-review.md 标记 CRITICAL，guard 阻塞 build

## TC-005: Cross-Artifact Consistency — Plan Coverage
- **Given**: proposal.Plan 包含 "实现 X" 但 design.Layers 未提及
- **When**: 运行 guard --apply checkDesignToBuild
- **Then**: 返回 E-DESIGN-010，列出缺失的步骤

## TC-006: Task Granularity Warning
- **Given**: hyperplan_result 中包含 20-min 任务
- **When**: 运行 guard checkBuildToVerify
- **Then**: 输出 W-DESIGN-001 警告，不阻塞

## TC-007: Backward Compatibility — Existing Changes
- **Given**: 旧的变更（无新字段）运行现有工作流
- **When**: 执行完整 archive 流程
- **Then**: 不受影响，不报错

## TC-008: Full Workflow Integration
- **Given**: 新变更按 full workflow 执行所有 5 个改进
- **When**: open → design → build → verify → archive
- **Then**: 每个阶段 guard 正确执行新增检查
