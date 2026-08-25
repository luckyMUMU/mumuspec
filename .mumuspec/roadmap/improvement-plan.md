---
title: MumuSpec 改进计划
created: 2026-08-22
source: 20-Round Loop Review
status: draft
---

# MumuSpec 改进计划

> 基于 20 轮审查循环结果制定，目标：提升 AI 作为编译器的效率与开发者可感知性

## 当前状态

| 指标 | 值 |
|------|-----|
| 综合评分 | 9.7/10 |
| 测试总数 | 4702 |
| 通过 | 4616 |
| 失败 | 86 (1.8%) |
| 模块数 | 16 |
| BOUNDARY.md 覆盖 | 15/16 |

---

## Phase 1: 测试基础设施修复（优先级：高）

**目标**：修复 86 个失败测试，将失败率从 1.8% 降至 < 0.5%

### 1.1 Mock 补全 — state-machine.js

**影响范围**：guard-handler (12 failures), graph-handler (8 failures), state-extra4 (10 failures)

**问题**：测试 mock 了 `src/change/state-machine.js` 但未导出 `activateProjectWorkflow`

**修复步骤**：
1. 定位所有 `vi.mock('../../../src/change/state-machine.js')` 调用
2. 在每个 mock 中添加 `activateProjectWorkflow: vi.fn()` 导出
3. 验证 guard-handler / graph-handler / state-extra4 测试通过

**验收标准**：`npx vitest run tests/cli/commands/guard-handler.test.ts` 全部通过

### 1.2 错误消息断言更新

**影响范围**：installer-ops (16 failures), state-handler (1 failure), knowledge-analysis (4 failures)

**问题**：测试断言的错误消息与实际输出不匹配（如 `'may not have completed'` vs `'Failed to install'`）

**修复步骤**：
1. 运行失败测试获取实际错误消息
2. 更新 `expect(...).toContain(...)` 断言以匹配实际输出
3. 确保错误消息语义不变（仅调整措辞匹配）

**验收标准**：所有 installer-ops 测试通过

### 1.3 guard-audit 测试修复

**影响范围**：guard-audit.test.ts (4 failures)

**修复步骤**：
1. 分析 guard-audit 测试的 mock 依赖
2. 补全缺失的 mock 导出或调整断言

**验收标准**：`npx vitest run tests/guard-audit.test.ts` 全部通过

---

## Phase 2: 代码质量提升（优先级：中）

**目标**：消除 any 类型，提升类型安全性

### 2.1 guard 模块 any 类型消除

**位置**：`src/guard/` 中 1 处 `any`

**修复步骤**：
1. 定位 `any` 使用位置
2. 根据上下文推断具体类型
3. 用 `unknown` 或具体类型替代

**验收标准**：`npx tsc --noEmit` 无 any 相关警告

### 2.2 全局 any 类型扫描

**修复步骤**：
1. 运行 `grep -r ": any" src/` 扫描所有 any 使用
2. 按模块优先级逐一替换

---

## Phase 3: 文档补全（优先级：中）

**目标**：提升 JSDoc 覆盖率，增强开发者可感知性

### 3.1 install 模块 JSDoc

**位置**：`src/install/` — 40 个导出仅 14 处 JSDoc

**修复步骤**：
1. 为 `installer.ts` / `installer-ops.ts` / `installer-registry.ts` 的公共函数添加 JSDoc
2. 重点标注：参数说明、返回值、抛出的错误

**验收标准**：公共函数 JSDoc 覆盖率 ≥ 80%

### 3.2 skill-authoring 模块 JSDoc

**位置**：`src/skill-authoring/protocol.ts` — 7 个导出 0 处 JSDoc

**修复步骤**：
1. 为 `protocol.ts` 的所有导出添加 JSDoc
2. 描述 Skill 协议的数据结构与约束

---

## Phase 4: 规范符合度（优先级：低）

**目标**：BOUNDARY.md 覆盖率 100%

### 4.1 team 模块 BOUNDARY.md

**状态**：已存在 `src/team/BOUNDARY.md`，但审查脚本未检测到（路径解析问题）

**修复步骤**：
1. 验证 `src/team/BOUNDARY.md` 存在且内容完整
2. 修复 `loop-review.ts` 中的路径检测逻辑（如需要）

---

## Phase 5: AI-as-Compiler 增强（优先级：中，长期）

**目标**：强化"AI 作为编译器"的核心定位

### 5.1 Spec→Code 追踪链

**描述**：为每个 spec 要求建立到具体代码实现的追踪链接

**实现方案**：
1. 在 spec.md 的 Enforcement 条目中添加 `@see path/to/implementation.ts`
2. 在代码关键位置添加 `// @spec SPEC-ID` 注释
3. 提供 `mumuspec trace <spec-id>` 命令查询实现位置

**预期影响**：AI 能清晰理解"为什么这样实现"，提升代码生成意图准确性

### 5.2 开发者反馈闭环

**描述**：建立开发者对 AI 生成代码的反馈机制

**实现方案**：
1. 在 `mumuspec feedback` 中添加 `code-review` 子命令
2. 反馈自动关联到对应的 spec 条目
3. 定期运行 `mumuspec knowledge extract` 将反馈提取为 spec 改进建议

---

## 执行顺序

```
Week 1: Phase 1 (测试修复) — 最高优先级，直接影响 CI/CD 可靠性
Week 2: Phase 2 + Phase 3 (质量 + 文档) — 并行推进
Week 3: Phase 4 + Phase 5 (规范 + 增强) — 长期价值
```

## 验收标准

| 阶段 | 指标 | 目标 |
|------|------|------|
| Phase 1 | 测试失败数 | ≤ 20 (当前 86) |
| Phase 2 | any 类型数 | 0 (当前 1) |
| Phase 3 | JSDoc 覆盖率 | ≥ 80% (当前 ~60%) |
| Phase 4 | BOUNDARY.md 覆盖 | 16/16 (当前 15/16) |
| Phase 5 | Spec→Code 追踪 | 核心模块 100% |
