---
layer: 0
scope: "."
last_updated: "2026-07-30"
---

## Requirement: Ponytail 基础编码约束

### SHALL
- 编写新代码前必须检查代码库中是否已有可复用的实现
- 新代码必须是最小可工作实现（仅写必要的代码）
- 有意简化必须用 ponytail: 注释标记原因

### SHALL NOT
- 禁止引入未被请求的抽象层（YAGNI）
- 禁止在标准库/平台特性已满足需求时引入新依赖
- 禁止生成未被请求的样板代码（boilerplate）
- 禁止用复杂方案替代简单方案（boring over clever）

### SHOULD
- 优先删除而非新增代码（deletion over addition）
- 理解问题后再写代码，而非边写边理解
- 对复杂请求提出质疑而非盲目实现

### Enforcement
- PONYTAIL-1: lint rule: detect unnecessary abstraction patterns (YAGNI check)
- PONYTAIL-2: lint rule: check for unnecessary new dependencies
- PONYTAIL-3: lint rule: detect boilerplate code patterns
- PONYTAIL-4: lint rule: detect overly clever solutions

## Requirement: 项目结构规范

### SHALL
- 所有 spec.md 文件必须包含有效的 frontmatter（layer, scope, last_updated）
- 每个正向要求至少需要一个对应的 Enforcement 条目
- 所有模块导出必须通过 index.ts 统一 re-export（禁止直接 import 子模块路径）
- 新增模块必须在 .mumuspec/index.yaml 中注册

### SHALL NOT
- 禁止约束内容使用无具体含义的占位符文本
- 禁止跳过 spec 校验直接构建（mumuspec validate 必须通过）
- 不可以在根级规范中定义具体模块的实现细节（这一要求分层到子目录）

### Enforcement
- STRUCT-1: frontmatter 校验（layer 为数字，scope 为有效路径）
- STRUCT-2: SHALL 必须有对应 Enforcement 条目
- STRUCT-3: 新增模块必须在 index.yaml children 中注册

## Requirement: 变更管理

### SHALL
- 代码变更必须通过 mumuspec new 创建变更跟踪
- 阶段转换必须通过 mumuspec state transition 执行
- 归档前必须通过 mumuspec check 全量校验
- **任何代码或规范变更都必须同步更新 package.json 和 src/cli.ts 中的版本号**

### SHALL NOT
- 禁止绕过变更状态机直接修改代码（无变更上下文）
- 禁止在 active change 存在时创建新变更（single_active_change 模式下）
- 禁止变更后不更新版本号（package.json 与 src/cli.ts 版本必须一致）

### Enforcement
- CHANGE-1: 检查 .mumuspec/changes/ 目录存在 active 变更
- CHANGE-2: 检查 phase 转换符合状态机规则
- CHANGE-3: prebuild-check.mjs 校验 package.json 与 src/cli.ts 版本一致性
- CHANGE-4: 变更内容涉及代码或规范时，version 字段必须有语义化版本增量

## Requirement: 环境规范（env-spec）

### SHALL
- 环境检测必须通过系统命令支持 Java（JDK/Maven/Gradle）、Node（Node.js/npm/pnpm/yarn）、Python 三大生态的识别（通过执行 `xxx --version` 等只读命令实现检测，无需引入额外依赖）
- 检测命令必须仅执行只读操作（`--version`、`which`、`echo`），禁止修改系统配置
- 检测结果必须过滤敏感环境变量（含 password/secret/token/key 的变量名）
- 全量环境检测必须在 2 秒内完成，单项检测必须有 1 秒超时保护
- env-spec.md 必须使用 `type: environment` frontmatter 标识
- Detected 部分必须由 `mumuspec env detect --save` 自动生成

### SHALL NOT
- 环境检测器不得执行网络请求
- 环境检测器不得修改任何系统文件
- env-spec.md 不得记录敏感信息
- 单工具检测失败不得阻断整体检测流程

### Enforcement
- ENV-1: env-detector.ts 实现并行检测且总耗时 < 2s
- ENV-2: 敏感变量过滤 MUST 覆盖 password/secret/token/key/credential/auth/private
- ENV-3: env-spec.md 格式校验（frontmatter + SHALL/SHALL NOT + Detected）


<!-- delta-merged from enhance-design-phase/DS-001-structured-design-template.md -->
---
title: Structured Design Template Enforcement
id: DS-001
scope: src/guard/phase-guard.ts
status: proposed
priority: P0
---

# Delta Spec: 结构化设计模板

## Current Behavior
Design.md 自由格式，无强制字段。guard 仅检查文件存在性。

## New Behavior
1. 定义 design-schema.yaml，列出必须字段及其验证规则
2. guard checkDesignToBuild 增加字段完整性检查
3. 缺少必填字段时返回 E-DESIGN-009

## Schema Definition
required_sections:
  - name: API Contracts
    patterns: ["## .*API", "## .*Endpoint"]
    required_for: [full]
  - name: Data Flow
    patterns: ["## .*Data Flow", "## .*数据流"]
    required_for: [full]
  - name: Error Specification
    patterns: ["## .*Error", "## .*错误"]
    required_for: [full]
  - name: Architecture Overview
    patterns: ["## .*Architecture", "## .*架构"]
    required_for: [full, tweak]
  - name: Implementation Layers
    patterns: ["## .*Implementation", "## .*Layer", "## .*实现"]
    required_for: [full, hotfix, tweak]
  - name: Constraints Analysis
    patterns: ["## .*Constraint", "## .*约束"]
    required_for: [full]
  - name: Risk Mitigation
    patterns: ["## .*Risk", "## .*风险", "## .*Mitigation"]
    required_for: [full]
  - name: Test Strategy
    patterns: ["## .*Test", "## .*测试"]
    required_for: [full, hotfix, tweak]

## Error Code
- E-DESIGN-009: Design 文档缺少必填字段，列出缺失 section



<!-- delta-merged from enhance-design-phase/DS-002-clarify-command.md -->
---
title: Clarification Loop Command
id: DS-002
scope: src/cli.ts, src/change/clarify.ts (new)
status: proposed
priority: P0
---

# Delta Spec: 澄清循环命令

## Current Behavior
无澄清功能，AI 直接生成 design.md。

## New Behavior
新增 `mumuspec clarify <change-name>` 命令：
1. 读取 proposal.md
2. 分析模糊描述、缺失信息、矛盾点
3. 生成最多 5 个澄清问题
4. 交互式提问（使用 AskQuestion 工具）
5. 答案写入 clarification-log.md
6. 提示 AI 将答案整合到 design.md

## CLI Interface
```
mumuspec clarify <change-name> [--max-questions 5]
```

## Output Files
- clarification-log.md — 记录问答内容

## Question Detection Rules
触发澄清的条件：
- proposal 中包含 "等"、"等等"、"类似" 等模糊限定词
- FR 的验收标准不可量化（缺少数字、百分比）
- 技术方案有多个可选路径但没有说明选择理由
- 影响范围不明确（影响哪些模块/接口）



<!-- delta-merged from enhance-design-phase/DS-003-ai-self-review.md -->
---
title: AI Self-Review Protocol
id: DS-003
scope: src/guard/design-reviewer.ts (new)
status: proposed
priority: P1
---

# Delta Spec: AI 自审协议

## Current Behavior
设计文档生成后直接可进入 build，无质量检查。

## New Behavior
新增 `mumuspec review <change-name>` 命令：
1. 读取 design.md + proposal.md + cognitive-map.yaml
2. 按 6 个维度逐项检查
3. 生成 design-review.md
4. CRITICAL 问题阻塞 build（guard 检查）

## Review Dimensions
- 完整性: design 覆盖 proposal 所有 FR（CRITICAL）
- 一致性: Architecture 与 Layers 描述一致（CRITICAL）
- 接口匹配: API Contracts 与 FR 用户交互对应（MAJOR）
- 风险闭环: Q4 risk 都有 mitigation（MAJOR）
- 约束可行: Performance/Security 可实现（MINOR）
- 测试可执行: Test Strategy 有量化验收标准（MAJOR）

## Guard Integration
- review_result 存储在 state 中
- 存在 CRITICAL 问题时 checkDesignToBuild 返回 E-DESIGN-011



<!-- delta-merged from enhance-design-phase/DS-004-cross-artifact-consistency.md -->
---
title: Cross-Artifact Consistency Check
id: DS-004
scope: src/guard/phase-guard.ts
status: proposed
priority: P1
---

# Delta Spec: 跨工件一致性检查

## Current Behavior
无跨工件校验，design.md 与 proposal.md 可能不一致。

## New Behavior
guard --apply 在 checkDesignToBuild 中增加一致性检查。

## Check Rules
1. Plan Coverage: proposal.Plan 每个步骤在 design.Layers 中有对应
2. FR Satisfaction: proposal 每个 FR 在 design 中被满足
3. Risk Coverage: cognitive-map Q4 risk 在 mitigation 中有对应
4. Delta-Spec Alignment: delta-specs 文件路径在 Layers 中出现

## Error Code
- E-DESIGN-010: 跨工件不一致，附上差异详情



<!-- delta-merged from enhance-design-phase/DS-005-task-granularity.md -->
---
title: Task Granularity Specification
id: DS-005
scope: src/guard/phase-guard.ts
status: proposed
priority: P2
---

# Delta Spec: 任务粒度规范

## Current Behavior
hyperplan_result 任务可任意大小，无约束。

## New Behavior
guard checkBuildToVerify 中增加粒度检查。

## Rules
- 单个 task 预估时间 > 15 min → W-DESIGN-001 警告
- 建议拆分方案（按文件/按逻辑单元）

## Warning Code
- W-DESIGN-001: 任务粒度过大（>15 min），建议拆分

