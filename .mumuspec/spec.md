---
layer: 0
scope: "."
last_updated: "2026-08-09"
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

## Requirement: 临时目录管理规范

### SHALL
- `.mumuspec/temp/` 目录作为**临时文件唯一合法存放处**，非规范文档、运行时日志、测试样本、迁移过渡文件一律存入此目录
- 归档阶段（finalize-archive）**必须**整理 temp/ 内容：有价值的内容导入 knowledge/ 对应分类，无价值内容直接清理
- 归档完成后 temp/ 应为空或仅保留"待用户确认"的过渡内容
- temp/ 目录必须在 `.gitignore` 中全局排除（不纳入版本控制）
- temp/ 子目录按归档来源分类：`design-archive/`、`designs-archive/`、`bundles-archive/`、`evals/`

### SHALL NOT
- 禁止在 temp/ 之外存放非规范文件（禁止在 .mumuspec/ 根目录散落 audit.log、*.yaml 样本等）
- 禁止将 temp/ 内容提交至 git（gitignore 兜底 + pre-commit 检查）
- 禁止 temp/ 长期积压未整理内容（每次归档必须触发清理）
- 禁止在 temp/ 中存放活跃变更的工件（变更工件在 changes/<name>/ 下）

### Enforcement
- TEMP-1: `.mumuspec/temp/` 目录必须存在
- TEMP-2: `.mumuspec/temp/` 必须在根 `.gitignore` 中被排除
- TEMP-3: finalize-archive 阶段必须提示用户清理 temp/
- TEMP-4: 禁止在 .mumuspec/ 根目录存放非规范文件（白名单：spec.md/prd.md/tech.md/goal.md/env-spec.md/prohibitions.md/glossary.md/index.yaml/config.yaml）

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


<!-- delta-merged from refactor-persistent-spec/refactor-persistent-spec-tech.md -->
# Delta-Tech: refactor-persistent-spec

## New SHALL

### SHALL: Distributed Spec Storage
- Each `.mumuspec/` directory SHALL contain `prd.md` (product perspective) and `tech.md` (technical perspective) instead of `spec.md` and `design.md`
- Root `.mumuspec/` SHALL additionally contain `goal.md`, `env-spec.md`, and retain `spec.md` (global charter) and `prohibitions.md`
- Root `spec.md` SHALL contain only cross-module global rules (Ponytail constraints, project structure, change management)

### SHALL: Distributed Change Storage
- Changes SHALL be stored in the `.mumuspec/changes/` of the directory where the change is scoped
- `single_active_change` SHALL be enforced per-scope, not globally
- Each scope (directory with `.mumuspec/`) MAY have at most one active change at a time
- Multiple parallel changes across different scopes SHALL be allowed

### SHALL: Scope Overflow Detection
- At change creation, the system SHALL validate that `affected_scopes` are within the current directory's subtree
- If `affected_scopes` exceed the current scope, the system SHALL reject with `E-CHANGE-008: scope overflow`
- During Design/Build phases, the Guard SHALL detect scope overflow when new affected files are discovered
- On scope overflow, the user SHALL be offered two options: reduce scope or escalate to parent

### SHALL: On-Demand Loading
- The loader SHALL support on-demand loading of `prd.md` and `tech.md` at any depth
- `index.yaml` SHALL provide `prd_summary` and `tech_summary` for each child entry
- The loader SHALL NOT hardcode a fixed number of layers to load

### SHALL: Delta-Spec Routing
- Delta-specs SHALL be named `<scope-path>-tech.md` or `<scope-path>-prd.md`
- At archive time, delta-tech files SHALL be merged into the corresponding scope's `tech.md`
- Delta-prd files SHALL be merged into the corresponding scope's `prd.md`
- Knowledge extraction SHALL remain centralized at root `.mumuspec/knowledge/`

## New SHALL NOT

### SHALL NOT: Dual Spec Systems
- Module-level `spec.md` SHALL NOT coexist with `tech.md` in the same `.mumuspec/` directory
- Module-level `design.md` SHALL NOT coexist with `prd.md` in the same `.mumuspec/` directory

### SHALL NOT: Hardcoded Layer Depth
- The loader SHALL NOT hardcode a fixed number of layers (e.g., 3) for loading spec context
- The loader SHALL NOT load both `prd.md` and `tech.md` with the same fixed depth strategy

### SHALL NOT: Global Single Active Change
- The system SHALL NOT enforce `single_active_change` globally when per-scope enforcement is active
- The system SHALL NOT create changes in root `.mumuspec/changes/` when the affected scope is within a subdirectory



<!-- delta-merged from refactor-init-and-archive/finalize-archive-command.md -->
# Delta Spec: Finalize-Archive Command

## ADDED

### SHALL
- MumuSpec SHALL provide a `finalize-archive <change-name>` CLI command
- finalize-archive SHALL merge delta-specs to corresponding scope's tech.md/prd.md
- finalize-archive SHALL update prohibitions.md with new constraints
- finalize-archive SHALL rebuild index.yaml from current file tree
- finalize-archive SHALL update code-graph snapshot
- finalize-archive SHALL perform knowledge extraction (cognitive-map to knowledge pages)
- finalize-archive SHALL clean worktree and release active change slot
- finalize-archive SHALL clean cache/indexed.yaml of stale entries
- finalize-archive SHALL prompt user to review and clean `.mumuspec/temp/` content, importing valuable items to `knowledge/` and deleting the rest
- After finalize-archive completes, SHALL pause and ask user whether to delete old spec.md/design.md files

### Enforcement
- FA-1: finalize-archive completes all sub-processes atomically (or with rollback)
- FA-2: finalize-archive verifies all delta-specs were merged before asking user about cleanup
- FA-3: finalize-archive respects backward compat — old spec.md/design.md kept by default

### SHALL NOT
- finalize-archive SHALL NOT delete old spec.md/design.md without explicit user confirmation
- finalize-archive SHALL NOT run on already-archived changes



<!-- delta-merged from refactor-init-and-archive/init-distributed-generation.md -->
# Delta Spec: Init Distributed Generation

## ADDED

### SHALL
- `mumuspec init` SHALL generate distributed `prd.md` and `tech.md` files across all module directories
- Tech.md generation SHALL proceed bottom-up (leaf directories first, then parents)
- Prd.md generation SHALL proceed top-down (root first, then children)
- Init SHALL infer tech.md content from code structure, imports, and test coverage
- Init SHALL infer prd.md content from README, code comments, and JSDoc
- Init SHALL create root-level files: `goal.md`, `env-spec.md`, `prd.md`, `tech.md`, `prohibitions.md`, `index.yaml`

### SHALL NOT
- Init SHALL NOT overwrite existing `prd.md` or `tech.md` files without `--force` flag
- Init SHALL NOT require user interaction during generation (fully automatic, review after)

## Requirement: 术语表管理规范

### SHALL
- 项目根目录 `.mumuspec/glossary.md` 作为**权威术语参考**（Ubiquitous Language），所有文档、代码注释、沟通均应使用其中定义的统一术语
- 新增术语须经过共识决策，禁止在不同文档中对同一术语赋予不同含义
- 术语表与规范/代码保持同步：当引入新命令、新模块、新流程时，必须在 glossary.md 中补充对应术语

### SHALL NOT
- 禁止术语表条目与 spec.md / tech.md / prd.md 中的定义相互矛盾
- 禁止省略术语的英文对照（原文引用场景依赖英文符号）
- 禁止将术语表用作实现规范约束的场所（约束入 spec.md，术语入 glossary.md）

### Enforcement
- GLOSSARY-1: glossary.md 必须存在于项目根 `.mumuspec/` 目录
- GLOSSARY-2: glossary.md 每条目必须包含"术语 / 英文 / 定义"三要素
- GLOSSARY-3: 新增命令/模块时检查 glossary.md 是否同步更新


<!-- delta-merged from capability-tier-design/capability-tier-design.md -->
# Delta Spec: 通用基础能力与专用工具分层

## New Requirement: 能力分层原则

### SHALL
- 每个命令必须声明自己的层级（`tier: "general" | "dedicated"`），通过 `CommandMetadata` 接口自描述
- 专用工具（dedicated）必须实现标准守门流程：前置校验 → 影响预览 → 显式确认 → 执行 → 后置验证 → 报告
- 通用基础能力（general）必须支持 `--dry-run` 模式，供用户预览操作结果
- 不可逆操作（archive / discard / force overwrite）必须要求二次确认（输入变更名称/key）
- 从通用能力切换到专用工具时，必须经过用户确认
- 通用能力的组合结果不得自动作为专用工具的输入
- 每个专用工具的确认提示必须展示影响范围预览
- dry-run 输出必须与实际执行输出格式一致

### SHALL NOT
- SHALL NOT 将通用能力标记为专用工具以提高"重要性"（分层基于风险等级）
- SHALL NOT 在执行通用能力时要求用户显式确认（除非用户在配置中显式启用）
- SHALL NOT 跳过专用工具的前置校验（即使"看起来没问题"）
- SHALL NOT 在用户未确认时执行不可逆操作
- SHALL NOT 通用能力组合产生副作用（通用能力必须是纯只读的）
- SHALL NOT 专用工具的能力降级为 general，除非风险变化经过评估并走契约变更流程

### SHOULD
- 专用工具应复用通用能力的校验逻辑，而非重复实现
- 不可逆操作应尽可能提供回滚方案或备份机制
- 能力层级的默认值应可通过 config.yaml 配置覆盖
- 专用工具在 hotfix 预设下可降级前置校验强度（但仍需用户确认）

### Enforcement
- CAP-1: 每个命令必须在代码中声明 `CommandMetadata`，包含 `tier` / `risk` / `confirmRequired` / `reversible` 字段
- CAP-2: 专用工具必须经过完整守门流程才能执行（可通过 `mumuspec capability <cmd>` 验证）
- CAP-3: 通用能力组合不得产生文件系统副作用（测试覆盖）
- CAP-4: 不可逆操作必须等待二次确认，确认输入必须匹配变更名称
- CAP-5: dry-run 输出与实际执行输出格式必须一致（schema 校验）

## New Requirement: 能力声明与自描述

### SHALL
- MumuSpec  SHALL 提供 `mumuspec capability <command>` 命令查询任意命令的能力属性
- 通用基础能力 SHALL 标记 `composable: true`，支持链式调用、并行探索、迭代深化
- 专用工具 SHALL 标记 `composable: false`，执行过程不可中断或跳转
- 能力层级的提升或降低 SHALL 走外部契约变更流程（影响分析 → 用户征询 → 文档同步 → 记录持久化）

### SHALL NOT
- SHALL NOT 允许运行时动态修改命令的能力层级（必须修改代码 + 评审）
- SHALL NOT 通过 `mumuspec capability` 查询不到的层级作为执行依据

### Enforcement
- CAP-DESC-1: `mumuspec capability` 必须能返回所有已注册命令的元数据
- CAP-DESC-2: 能力元数据必须与代码实现一致（CI 校验）
- CAP-DESC-3: 能力层级变更必须在 `.mumuspec/contracts/` 中有对应记录

