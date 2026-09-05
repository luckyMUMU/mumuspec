---
layer: 0
scope: "."
last_updated: "2026-08-29"
prohibitions:
  - text: "禁止引入未被请求的抽象层（YAGNI）"
    annotation:
      type: no-new-dependency
      scope: module
      rationale: "Matches YAGNI/unrequested dependency prohibition (auto-detected)"
  - text: "禁止在标准库/平台特性已满足需求时引入新依赖"
    annotation:
      type: no-new-dependency
      scope: module
      rationale: "Matches YAGNI/unrequested dependency prohibition (auto-detected)"
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
- Each `.mumuspec/` directory SHALL contain `prd.md` (product perspective) and `tech.md` (technical perspective) instead of `spec.md` and `design.md`
- Root `.mumuspec/` SHALL additionally contain `goal.md`, `env-spec.md`, and retain `spec.md` (global charter) and `prohibitions.md`
- Root `spec.md` SHALL contain only cross-module global rules (Ponytail constraints, project structure, change management)
- Changes SHALL be stored in the `.mumuspec/changes/` of the directory where the change is scoped
- `single_active_change` SHALL be enforced per-scope, not globally
- Each scope (directory with `.mumuspec/`) MAY have at most one active change at a time
- Multiple parallel changes across different scopes SHALL be allowed
- At change creation, the system SHALL validate that `affected_scopes` are within the current directory's subtree
- If `affected_scopes` exceed the current scope, the system SHALL reject with `E-CHANGE-008: scope overflow`
- During Design/Build phases, the Guard SHALL detect scope overflow when new affected files are discovered
- On scope overflow, the user SHALL be offered two options: reduce scope or escalate to parent
- The loader SHALL support on-demand loading of `prd.md` and `tech.md` at any depth
- `index.yaml` SHALL provide `prd_summary` and `tech_summary` for each child entry
- The loader SHALL NOT hardcode a fixed number of layers to load
- Delta-specs SHALL be named `<scope-path>-tech.md` or `<scope-path>-prd.md`
- At archive time, delta-tech files SHALL be merged into the corresponding scope's `tech.md`
- Delta-prd files SHALL be merged into the corresponding scope's `prd.md`
- Knowledge extraction SHALL remain centralized at root `.mumuspec/knowledge/`
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
- `mumuspec init` SHALL generate distributed `prd.md` and `tech.md` files across all module directories
- Tech.md generation SHALL proceed bottom-up (leaf directories first, then parents)
- Prd.md generation SHALL proceed top-down (root first, then children)
- Init SHALL infer tech.md content from code structure, imports, and test coverage
- Init SHALL infer prd.md content from README, code comments, and JSDoc
- Init SHALL create root-level files: `goal.md`, `env-spec.md`, `prd.md`, `tech.md`, `prohibitions.md`, `index.yaml`

### SHALL NOT
- 禁止绕过变更状态机直接修改代码（无变更上下文）
- 禁止变更后不更新版本号（package.json 与 src/cli.ts 版本必须一致）
- Module-level `spec.md` SHALL NOT coexist with `tech.md` in the same `.mumuspec/` directory
- Module-level `design.md` SHALL NOT coexist with `prd.md` in the same `.mumuspec/` directory
- The loader SHALL NOT hardcode a fixed number of layers (e.g., 3) for loading spec context
- The loader SHALL NOT load both `prd.md` and `tech.md` with the same fixed depth strategy
- The system SHALL NOT enforce `single_active_change` globally when per-scope enforcement is active
- The system SHALL NOT create changes in root `.mumuspec/changes/` when the affected scope is within a subdirectory
- finalize-archive SHALL NOT delete old spec.md/design.md without explicit user confirmation
- finalize-archive SHALL NOT run on already-archived changes
- Init SHALL NOT overwrite existing `prd.md` or `tech.md` files without `--force` flag
- Init SHALL NOT require user interaction during generation (fully automatic, review after)

### SHOULD NOT (CHG-5: 过程约束降级，advisory only)
- ~~禁止在 active change 存在时创建新变更~~ → medium 强度自动关闭 single_active_change
- 工作流规则 top_down_design / tdd_enforced 默认关闭（TD=medium 时自动 false）
- LLM 可自主选择设计深度、实现策略和测试方式（结果约束为 verify 通过）

### Enforcement
- CHANGE-1: 检查 .mumuspec/changes/ 目录存在 active 变更
- CHANGE-2: 检查 phase 转换符合状态机规则
- CHANGE-3: prebuild-check.mjs 校验 package.json 与 src/cli.ts 版本一致性
- CHANGE-4: 变更内容涉及代码或规范时，version 字段必须有语义化版本增量
- FA-1: finalize-archive completes all sub-processes atomically (or with rollback)
- FA-2: finalize-archive verifies all delta-specs were merged before asking user about cleanup
- FA-3: finalize-archive respects backward compat — old spec.md/design.md kept by default

## Requirement: 术语表管理规范

### SHALL
- 项目根目录 `.mumuspec/glossary.md` 作为**权威术语参考**（Ubiquitous Language），所有文档、代码注释、沟通均应使用其中定义的统一术语
- 新增术语须经过共识决策，禁止在不同文档中对同一术语赋予不同含义
- 术语表与规范/代码保持同步：当引入新命令、新模块、新流程时，必须在 glossary.md 中补充对应术语
- 每个命令必须声明自己的层级（`tier: "general" | "dedicated"`），通过 `CommandMetadata` 接口自描述
- 专用工具（dedicated）必须实现标准守门流程：前置校验 → 影响预览 → 显式确认 → 执行 → 后置验证 → 报告
- 通用基础能力（general）必须支持 `--dry-run` 模式，供用户预览操作结果
- 不可逆操作（archive / discard / force overwrite）必须要求二次确认（输入变更名称/key）
- 从通用能力切换到专用工具时，必须经过用户确认
- 通用能力的组合结果不得自动作为专用工具的输入
- 每个专用工具的确认提示必须展示影响范围预览
- dry-run 输出必须与实际执行输出格式一致
- MumuSpec  SHALL 提供 `mumuspec capability <command>` 命令查询任意命令的能力属性
- 通用基础能力 SHALL 标记 `composable: true`，支持链式调用、并行探索、迭代深化
- 专用工具 SHALL 标记 `composable: false`，执行过程不可中断或跳转
- 能力层级的提升或降低 SHALL 走外部契约变更流程（影响分析 → 用户征询 → 文档同步 → 记录持久化）

### SHALL NOT
- 禁止术语表条目与 spec.md / tech.md / prd.md 中的定义相互矛盾
- 禁止省略术语的英文对照（原文引用场景依赖英文符号）
- 禁止将术语表用作实现规范约束的场所（约束入 spec.md，术语入 glossary.md）
- SHALL NOT 将通用能力标记为专用工具以提高"重要性"（分层基于风险等级）
- SHALL NOT 在执行通用能力时要求用户显式确认（除非用户在配置中显式启用）
- SHALL NOT 跳过专用工具的前置校验（即使"看起来没问题"）
- SHALL NOT 在用户未确认时执行不可逆操作
- SHALL NOT 通用能力组合产生副作用（通用能力必须是纯只读的）
- SHALL NOT 专用工具的能力降级为 general，除非风险变化经过评估并走契约变更流程
- SHALL NOT 允许运行时动态修改命令的能力层级（必须修改代码 + 评审）
- SHALL NOT 通过 `mumuspec capability` 查询不到的层级作为执行依据

### SHOULD
- 专用工具应复用通用能力的校验逻辑，而非重复实现
- 不可逆操作应尽可能提供回滚方案或备份机制
- 能力层级的默认值应可通过 config.yaml 配置覆盖
- 专用工具在 hotfix 预设下可降级前置校验强度（但仍需用户确认）

### Enforcement
- GLOSSARY-1: glossary.md 必须存在于项目根 `.mumuspec/` 目录
- GLOSSARY-2: glossary.md 每条目必须包含"术语 / 英文 / 定义"三要素
- GLOSSARY-3: 新增命令/模块时检查 glossary.md 是否同步更新
- CAP-1: 每个命令必须在代码中声明 `CommandMetadata`，包含 `tier` / `risk` / `confirmRequired` / `reversible` 字段
- CAP-2: 专用工具必须经过完整守门流程才能执行（可通过 `mumuspec capability <cmd>` 验证）
- CAP-3: 通用能力组合不得产生文件系统副作用（测试覆盖）
- CAP-4: 不可逆操作必须等待二次确认，确认输入必须匹配变更名称
- CAP-5: dry-run 输出与实际执行输出格式必须一致（schema 校验）
- CAP-DESC-1: `mumuspec capability` 必须能返回所有已注册命令的元数据
- CAP-DESC-2: 能力元数据必须与代码实现一致（CI 校验）
- CAP-DESC-3: 能力层级变更必须在 `.mumuspec/contracts/` 中有对应记录

## Requirement: Verifier 语义与可验证性（0.20）

### SHALL
- 每条 SHALL / SHALL NOT 约束必须可归入四分类之一：enforced-strong（annotation→AST）、enforced-weak（正则兜底可提取）、manual（显式 `manual(原因)` 或存量自由文本）、unverifiable（格式缺陷）
- SHALL NOT 红线无可验证通道时必须被 E-SPEC-015 阻断（`enforcement_strict` 默认 true，opt-out 仅限观察态）
- manual 类约束在归档前必须持有 verify.md 验证记录（按 Enforcement ID 或约束原文锚定，E-VERIFY-003）
- `mumuspec validate` / `check --json` / MCP 必须输出 `enforcement_coverage` 五桶计量（declared_ratio 为主指标）
- 可验证性与约束强度正交：unverifiable 的 SHALL NOT 在任何强度组合下恒 block

### SHALL NOT
- 禁止无 enforcement 声明的 SHALL 进入强制面（E-SPEC-004 恒可见，不得被低强度折叠丢弃）
- 禁止以 `--force` 越过 E-SPEC-015（forceable: false；唯一出路是补 annotation、改写为可提取文本或声明 manual）
- 禁止自动注解产出与约束语义无关的通道映射（如"样板代码→no-side-effect"，F8 教训）

### Enforcement
- V-1: E-SPEC-015 SPEC_SHALL_NOT_UNVERIFIABLE（ERROR, forceable: false, always_enforce）
- V-2: E-VERIFY-003 MANUAL_EVIDENCE_MISSING（ERROR, forceable: true，走 accept-deviations 旁路）
- V-3: enforcement_coverage 计量（src/spec/verifier-classify.ts 纯函数分类器）
- V-4: docs/design/constraint-strength.md §9.0 可验证性前置判定（求值序 0）

## Requirement: 流程执行载体（CLI-first）

### SHALL
- 确定性工作流步骤（阶段转换、guard 校验、hash 锁定、决策登记、套件锁定、layer 状态、工件初始化）必须通过 CLI 命令执行
- LLM 决策域保留为：需求澄清（brainstorming）、设计创作（design.md/cognitive-map 条目）、对抗审查（Hyperplan/grill-me 问答内容）、偏差接受建议、用户确认的组织与传达
- skill 指令中引用的 CLI 命令必须与命令注册表一致（目标阶段、参数签名、--confirm 要求）
- skill 文本中的确定性操作必须指向既有命令；新增确定性步骤必须先落命令再写 skill

### SHALL NOT
- 禁止手工编辑由 CLI 管理的审计与状态工件：decisions.md 追加（须 `decisions append`，手工编辑破坏 content_hash → E-CHANGE-007）、`.mumuspec.yaml` 状态字段（须 `state set` / `state layer`，受保护字段绕过须审计 E-STATE-001）、suite hash（须 `test-cases lock-suite`）
- 禁止 LLM 自行计算或手写 hash 类字段（design_content_hash / suites_hash）
- 禁止 skill 指示使用状态机不存在的目标阶段（如 verify-fail / archive-reopen）
- 禁止在无对应命令的情况下将确定性步骤写入 skill（先命令后文档）

### Enforcement
- F-1: E-CHANGE-007 decisions content_hash 篡改检测
- F-2: E-STATE-001 受保护字段审计 / guard.bypass_audit 拒绝
- F-3: `mumuspec tasks next` / `test-cases lock-suite --layer` / `state layer`（0.20 CLI-first 命令）
- F-4: 状态机边校验（无效目标阶段即拒绝，含 verify-fail/archive-reopen 类历史误写）
- F-5: manual(由 review 流程核对 skill 引用的命令与注册表一致——P1 候选：清单化生成校验)
