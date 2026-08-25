---
name: phase-verify
description: "MumuSpec Phase 4: Verify。以 /phase-verify 启动。规范校验 + 漂移检测 + 测试不可变性验证 + 分支处理。"
---

# Phase: Verify — 验证（规范校验 + 漂移检测 + 分支处理）

> **阶段**: 4 · **workflow**: full

## 快速决策（Decision Core）

**前置条件**：代码已提交（Build 阶段完成），所有 tasks.md 任务完成

**阻塞点**：
- BP-14: 验证失败修复/接受偏差
- BP-15: Spec 漂移处理
- BP-16: 分支处理方式选择

**退出条件**：验证报告通过，分支已处理，Phase Guard 通过

---

## 前置条件

- 代码已提交（Phase 3 完成）
- 所有 tasks.md 任务完成
- `build_layers` 全部 `status = done`
- 测试全绿

---

## 执行步骤

### Step 0: 输出语言约束

验证报告和分支处理记录必须使用触发本工作流的用户请求的语言。

**幂等性**：所有 verify 阶段检查可安全重执行。若 `verify_result` 已为 `pass` 且 `branch_status` 为 `handled`，直接执行 guard 转换。

### Step 1: 入口状态验证

```bash
mumuspec state check <name> verify
```

### Step 1b: 规模评估

```bash
mumuspec state scale <change-name>
```

脚本自动计数任务数、delta spec 数、变更文件数，决定 light 或 full 验证模式。

**决策规则**（满足任一即 full）：任务 > 3，delta spec 能力 > 1，变更文件 > 4。

**覆盖机制**：Agent 或用户可随时 `mumuspec state set <name> verify_mode <light|full>` 覆盖。

### Step 2: 工件上下文加载

**立即执行**：使用 Skill 工具加载 `verification-before-completion` skill。跳过此步骤被禁止。

#### Hash 按需读取优化

```bash
RECORDED_HASH=$(mumuspec state get <change-name> design_content_hash)
CURRENT_HASH=$(mumuspec test-cases hash --change <name>)
```

- 若 hash 匹配：test-cases/ 不需重新全量读取
- 若 hash 不匹配：全量读取所有必需文件

> proposal.md 和 design.md 包含验证所需的完整上下文，不可因 hash 匹配跳过。

### Step 2a: 轻量验证（小变更）

运行 5 项检查：

1. 所有 tasks.md 任务完成 `[x]`
2. 变更文件匹配 tasks.md 描述
3. 构建通过
4. 相关测试通过
5. 无明显安全问题

**通过标准**：全部 OK，无 CRITICAL 问题。

**跳过项**：spec 场景覆盖、设计文档深度对比、代码模式一致性建议、漂移检测。

### Step 2b: 完整验证（大变更）

**立即执行**：使用 Skill 工具加载 `verification-before-completion` skill。

检查项：
1. 所有 tasks.md 任务完成
2. 实现匹配 design.md 高层设计决策
3. 所有能力 spec 场景通过
4. proposal.md 目标已满足
5. delta spec 与 design.md 无矛盾
6. 关联设计文档可定位

### Step 3: MumuSpec 独有验证维度

#### 3a: 规范一致性校验

- SHALL 检查：所有正向要求已实现
- SHALL NOT 检查：无反向禁止违规
- Enforcement 检查：所有 lint 规则通过

```bash
mumuspec validate --change <name>
mumuspec check --shall --change <name>
mumuspec check --shall-not --change <name>
```

#### 3b: 漂移检测

```bash
mumuspec drift detect --change <name>
```

检测类型：
- 规范漂移（spec_drift）
- 图谱漂移（graph_drift）
- 测试不可变性漂移（test_immutability_drift）
- 设计文档漂移（design_doc_drift）
- 契约漂移（contract_drift）
- 知识漂移（knowledge_drift）
- Ponytail 漂移（ponytail_drift）

#### 3c: 代码图谱完整性

```bash
mumuspec graph verify --change <name>
```

- 调用链完整，无意外破坏性变更
- 代码图谱与实际代码一致

#### 3d: 测试不可变性验证

```bash
mumuspec test-cases verify --change <name>
```

- test-cases hash 一致
- 套件 hash 一致
- 所有层套件通过

#### 3e: 契约兼容性验证

```bash
mumuspec contract verify --change <name>
mumuspec contract drift --change <name>
```

#### 3f: 知识新鲜度验证

```bash
mumuspec knowledge verify --all
```

### Step 4: 验证失败决策 — BLOCKING POINT (BP-14)

验证不通过时，**必须使用平台用户输入/确认机制暂停等待用户决定修复或接受偏差**。

暂停时列出：
- 失败项
- 是否 CRITICAL（构建失败/测试失败/安全问题/核心验收场景失败）
- 推荐处理方式

**不确定性原则**：严重性不明确时降级（SUGGESTION > WARNING > CRITICAL）。

**用户选项**：
- **全部修复**：运行 `mumuspec state transition <name> verify-fail`，调用 `phase-build` 修复
- **逐项处理**：CRITICAL 必须修复；非 CRITICAL 可接受偏差但须记录理由

**重试限制**：连续 3 次 verify-fail 后，第 4 次失败时**必须暂停**，仅提供两个选项："接受所有偏差并记录"或"继续修复"。

### Step 5: Spec 漂移处理 — BLOCKING POINT (BP-15)

若检查发现 delta spec 与 design.md 有矛盾：

**必须使用平台用户输入/确认机制作为单选题暂停等待用户选择**：

| 选项 | 行为 |
|------|------|
| A | 在 design.md 追加"实现偏差"章节记录偏离原因 |
| B | 回退到 Build 更新 Design Doc + delta spec |
| C | 确认偏差可接受，继续验证（归档时标记 `superseded-by-main-spec`） |

### Step 6: 分支处理 — BLOCKING POINT (BP-16)

**立即执行**：使用 Skill 工具加载 `finishing-a-development-branch` skill。跳过此步骤被禁止。

分支处理选项：
1. 合并到主分支（本地）
2. 推送并创建 PR
3. 保留分支（稍后处理）
4. 废弃工作

**必须使用平台用户输入/确认机制暂停等待用户选择。** 不可基于推荐/默认/当前分支状态选择。

**确认项**：
- 所有测试通过
- 无硬编码密钥或安全问题

### Step 7: 记录验证证据

验证报告保存到磁盘并记录到 `.mumuspec.yaml`：

```bash
mumuspec state set <name> verification_report verify.md
mumuspec state set <name> branch_status handled
```

---

## 退出条件

- 验证报告通过
- 分支已处理
- `verification_report` 指向存在的验证报告文件
- `branch_status: handled`
- 所有 SHALL enforcements 通过
- 所有 SHALL NOT enforcements 通过
- 无 critical drift
- 代码图谱完整性验证
- 测试不可变性验证
- `decisions_log.counts.verify > 0` + hash 匹配
- **Phase Guard**：运行 `mumuspec guard <name> verify --apply`

---

## Phase Guard 调用

```bash
mumuspec guard <change-name> verify --apply
```

Guard 检查项（`verify_to_archive`）：
- verify_result: pass
- verify.md exists with report
- all SHALL enforcements passed
- all SHALL NOT enforcements passed
- no critical drift detected
- code-graph integrity verified
- all build_layers verified bottom-up
- all_delta_spec_requirements_implemented: true
- test_immutability_verified: true
- decisions_log.counts.verify > 0 + hash matches

---

## 自动流转到下一阶段

```bash
mumuspec state next <change-name>
```

- `NEXT: auto` → 调用 `phase-archive`
- `NEXT: manual` → 提示用户手动运行 `phase-archive`

> 注意：`phase-archive` 启动后，必须先执行归档最终确认阻塞点 (BP-17)，等待用户显式选择"确认归档"后才运行归档脚本。不可因验证通过就自动归档。

---

## 上下文压缩恢复

```bash
mumuspec state check <change-name> verify --recover
```

脚本输出结构化恢复上下文（阶段、验证状态、分支状态、恢复动作）。

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "验证差不多过了" | 验证未通过 ≠ 通过 — 检查 verify_result |
| "小问题可以忽略" | CRITICAL 必须修复 — 不可接受偏差 |
| "漂移不重要" | 漂移检测是阶段守卫必检项 — BP-15 必须处理 |
| "分支处理我来定" | 必须用户选择 — BP-16 不可自动决策 |
| "测试 hash 不匹配就算了" | 测试不可变性是硬约束 — 不匹配即失败 |
| "图谱完整性可以跳过" | 代码图谱完整性是阶段守卫必检项 |
| "Ponytail 漂移不影响功能" | ponytail_drift 纳入漂移检测 — 不可跳过 |
| "3 次失败了继续修" | 第 4 次失败必须暂停 — 仅接受偏差或继续修复 |
| "契约兼容性之前检查过了" | verify 阶段需再次检查 — 可能 Build 中引入新变更 |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required |
|------|-----------|----------|
| 完成验证 | `verification-before-completion` | true |
| 代码审查 | `requesting-code-review` | true |
| 接收反馈 | `receiving-code-review` | true |
| 回退决策 | `systematic-debugging` | false |
| 浏览器验证 | `browser-testing-with-devtools` | false |
| 安全验证 | `security-and-hardening` | false |
| 性能回归 | `performance-optimization` | false |
| 分支处理 | `finishing-a-development-branch` | true |
