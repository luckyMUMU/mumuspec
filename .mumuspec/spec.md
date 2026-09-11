---
layer: 0
scope: "."
last_updated: "2026-09-05"
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
- `.mumuspec/temp/` 目录作为**临时文件唯一合法存放处**（按需创建），非规范文档、运行时日志、测试样本、迁移过渡文件一律存入此目录
- 归档阶段（finalize-archive）**必须**整理 temp/ 内容：有价值的内容导入 knowledge/ 对应分类，无价值内容直接清理
- 归档完成后 temp/ 应为空或仅保留"待用户确认"的过渡内容
- temp/ 目录必须在 `.gitignore` 中全局排除（不纳入版本控制）
- temp/ 子目录按归档来源分类：`bundles-archive/`、`evals/`
- `.mumuspec/designs-archive/` 为**版本化设计归档目录**（纳入版本控制），存放已被现行方案取代但保留追溯价值的设计草案（doc-governance-decisions 裁决，2026-09-06）

### SHALL NOT
- 禁止在 temp/ 之外存放非规范文件（功能性状态文件 constraints.yaml / audit.log / agents-hash.json 除外，见 TEMP-4 白名单）
- 禁止将 temp/ 内容提交至 git（gitignore 兜底 + pre-commit 检查）
- 禁止 temp/ 长期积压未整理内容（每次归档必须触发清理）
- 禁止在 temp/ 中存放活跃变更的工件（变更工件在 changes/<name>/ 下）

### Enforcement
- TEMP-1: `.mumuspec/temp/` 使用时创建，结构校验器不得因 temp/ 存在报 E-SPEC-013
- TEMP-2: `.mumuspec/temp/` 必须在根 `.gitignore` 中被排除
- TEMP-3: finalize-archive 阶段必须提示用户清理 temp/
- TEMP-4: 禁止在 .mumuspec/ 根目录存放非规范文件（白名单：spec.md/prd.md/tech.md/design.md/goal.md/env-spec.md/prohibitions.md/glossary.md/index.yaml/config.yaml/workflow.yaml/constraints.yaml/audit.log/agents-hash.json + designs-archive/ 目录）

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
- Root `.mumuspec/` SHALL contain: `spec.md` (global charter)、`design.md` (root design index)、`prd.md`、`tech.md`、`goal.md`、`env-spec.md`、`prohibitions.md`、`glossary.md`、`index.yaml`、`config.yaml`、`constraints.yaml` (动态约束强度持久化)、`workflow.yaml` (项目级流程 override)
- 项目级 `.mumuspec/workflow.yaml` 存在且合法时，guard 入口必须加载并生效（source 'project'）；损坏或非法时必须 WARN 并回退内置默认（CHG-7）
- workflow.yaml 的 phases 顺序必须与 phase-graph.ts 的 PHASE_ORDER 保持同构（CHG-6 单一事实源为 `src/change/workflow.default.yaml`，AC-01 测试锁定）
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

## Requirement: 文档产出规范（结果导向）

### SHALL
- 生成的文档只记录结果与结论（最终状态、事实、结论本身），过程性信息仅在被用户明确要求时写入
- 有意保留的过程性内容必须显式标注（如 `process:` 前缀标记），便于归档时清理

### SHALL NOT
- 禁止在文档中记录思考过程、推理链或生成过程回顾（除非用户明确要求）
- 禁止在文档中记录生成该文档所用到的要求、命令、提示词等元信息
- 禁止在文档中写对齐来源、修改说明类元注释（如"（与 XX 对齐）"、"本次更新了…"）
- 禁止保留过期或无效的文档内容（类比代码死代码——应删除而非注释保留）
- 禁止生成多余的说明性注释

### Enforcement
- DOC-1: manual(code review 核对产出文档无过程性内容与元注释)
- DOC-2: enforced-weak(正则兜底可提取：扫描"（与 …对齐）"类括号元注释与"本次/此次更新"类过程回顾句式)

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

## Requirement: 命令能力分层（Capability Tier）

### SHALL
- 每个命令必须声明自己的层级（`tier: "general" | "dedicated"`），通过 `CommandMetadata` 接口自描述
- 专用工具（dedicated）必须实现标准守门流程：前置校验 → 影响预览 → 显式确认 → 执行 → 后置验证 → 报告
- 通用基础能力（general）必须支持 `--dry-run` 模式，供用户预览操作结果
- 不可逆操作（archive / discard / force overwrite）必须要求二次确认（输入变更名称/key）
- 从通用能力切换到专用工具时，必须经过用户确认
- 通用能力的组合结果不得自动作为专用工具的输入
- 每个专用工具的确认提示必须展示影响范围预览
- dry-run 输出必须与实际执行输出格式一致
- MumuSpec SHALL 提供 `mumuspec capability <command>` 命令查询任意命令的能力属性
- 通用基础能力 SHALL 标记 `composable: true`，支持链式调用、并行探索、迭代深化
- 专用工具 SHALL 标记 `composable: false`，执行过程不可中断或跳转
- 能力层级的提升或降低 SHALL 走外部契约变更流程（影响分析 → 用户征询 → 文档同步 → 记录持久化）

### SHALL NOT
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


<!-- delta-merged from goal-p0-dispatch-gate/completeness-gate.md (2026-09-05 归档合并) -->

## Requirement: 完备性门禁 — 结构化完备性工件

设计完备性判定必须产出机器可读的结构化工件，而非自由文本结论。

### SHALL

- Design 与 Verify 阶段产出 `open-questions.yaml`（未决问题清单）与 `assumptions.yaml`（未确认假设清单），均带 `version:` 字段。
- 每条未决问题 / 假设携带状态（open / resolved / accepted / deferred）与消解去向（决策日志条目 id）。
- 工件写入变更目录并纳入变更状态管理。

### SHALL NOT

- 禁止以自由文本形式声明"设计完备"（完备性结论必须可由工件状态推导）。
- 禁止把"完备"与"正确"混同：完备性工件不得包含正确性断言（正确性由 test-cases 锁定与 Verify 承担）。

### Enforcement

- ENF-1: enforced-strong(schema 校验：字段、状态枚举、version 存在)
- ENF-2: enforced-strong(工件状态与 decisions 日志交叉断言：resolved 条目必有决策去向)

## Requirement: 完备性门禁 — 双签放行

完备性门禁 = LLM 判定（advisory）+ 人工签收（放行条件），机械校验保持一票否决。

### SHALL

- design→build 转换时，phase-guard 校验：存在 open 状态未决问题且未经人工签收（accept/defer 带理由）时返回 block。
- LLM 完备性判定仅以 advisory 身份进入 guard 结果，不得单独放行。
- 机械四分类校验（enforced-strong / enforced-weak / manual / unverifiable）保持既有 block 语义不变。

### SHALL NOT

- 禁止在无人工签收记录的情况下因 LLM 判定"完备"而放行阶段转换。
- 禁止降级或绕过机械四分类的一票否决。

### Enforcement

- ENF-3: enforced-strong(guard 单元测试：无签收 + LLM 判完备 → 断言 block)
- ENF-4: enforced-strong(guard 单元测试：机械校验失败 → 断言 block 优先于任何 advisory 结论)
- ENF-5: manual(真实变更中人工签收流程可用性走查，evidence 记入 verify.md)



<!-- delta-merged from goal-p0-dispatch-gate/dispatch-layer.md (2026-09-05 归档合并) -->

## Requirement: 分发层 — AGENTS.md canonical 生成

MumuSpec 必须能生成 AGENTS.md 作为唯一权威 Rules 文件，并通过薄壳桥接覆盖全部主流 agent。

### SHALL

- 提供 AGENTS.md 生成器，产出内容包含：规范链摘要、Ponytail 约束、CLI 命令速查、MCP 调用入口指引。
- 生成 CLAUDE.md 薄壳，首行为 `@AGENTS.md`。
- 生成 GEMINI.md 薄壳，并提示用户在 settings.json 的 context.fileName 中加入 AGENTS.md。
- installer-registry 新增 codex、windsurf、gemini、copilot 四个 AgentType，且各自完成 install 后具有可用的入口文件。

### SHALL NOT

- 禁止生成 `.cursorrules` 与 `.windsurfrules`（遗留格式）。
- 禁止在 Rules 文件中内联全量规范上下文（渐进式披露职责归 MCP，Rules 文件受 32KiB 容量预算约束）。
- 禁止在目标位置已存在用户手写的 AGENTS.md / CLAUDE.md 时静默覆盖。

### Enforcement

- ENF-1: enforced-strong(install/init 落盘断言：AGENTS.md 存在且含四要素；CLAUDE.md 首行 `@AGENTS.md`)
- ENF-2: enforced-strong(源码级断言：生成路径中不出现 .cursorrules / .windsurfrules)
- ENF-3: enforced-strong(容量断言：生成产物 ≤ 32KiB)
- ENF-4: manual(薄壳在真实 Claude Code 会话中被加载，evidence 记入 verify.md)

## Requirement: 分发层 — phase skill 平权

阶段 Skill 对所有支持的 agent 可用，不因 agent 而缺失。

### SHALL

- phase-open / phase-design / phase-build / phase-verify / phase-archive 以目录式 SKILL.md 分发给全部已注册 agent。

### Enforcement

- ENF-5: enforced-strong(对每个 AgentType 执行 install 后断言五个 phase skill 文件存在)



<!-- delta-merged from goal-p0-dispatch-gate/rule-driven-implementation.md (2026-09-05 归档合并；依据 KP-0060，与「流程执行载体（CLI-first）」块同构，作为其一般化上位原则) -->

## Requirement: 规则-实现分离（Rule-Driven Implementation）

### SHALL

- 凡给定规则后可由工具确定性实现的相对固定部分，必须由代码实现；LLM 仅创建声明式规则（spec、delta-specs、workflow yaml、结构化工件、模板填充内容）。
- 代码在消费 LLM 创建的规则前必须执行校验（schema + 语义），校验失败必须拒绝执行并产出诊断错误码。
- 新增确定性能力的实现顺序必须为：先规则 schema 与校验器，再引擎消费，最后 skill / LLM 指引。
- LLM 决策域保留为：规则创作、歧义澄清（grill-me 问答）、设计创作、对抗审查、偏差接受建议。

### SHALL NOT

- 禁止将相对固定的执行逻辑以 LLM 现场发挥方式实现（LLM 不充当引擎）。
- 禁止在无对应校验器的情况下引入新的 LLM 结构化产出物（先校验器后消费者）。
- 禁止代码静默消费校验失败的规则（fail-open）。

### Enforcement

- F-1: 既有实例——可验证性四分类校验器（verifier-classify）+ E-SPEC-015 红线未声明验证方式恒 block
- F-2: 既有实例——状态机边校验拒绝无效目标阶段（E-CHANGE-006）与受保护字段审计（E-STATE-001）
- F-3: 本变更新增实例——分发层生成器以声明式配置为输入、生成物经代码校验；完备性门禁 schema 校验器拒绝非法 open-questions / assumptions 工件（见 delta-specs/completeness-gate.md ENF-1/ENF-2）
- F-4: drift / CI 校验覆盖新增规则 schema，防止规则与校验器漂移



<!-- delta-merged from 2026-09-09-completeness-artifacts-freedom-metrics/freedom-metrics.md -->
# Delta Spec: 自由度最小度量回路

## Requirement: 约束密度度量

auto-evaluate 框架必须能度量变更影响域的约束密度，作为实现自由度的代理指标。

### SHALL

- 新增 `constraint-density` evaluator，实现既有 Evaluator 接口（name / defaultWeight / evaluate）。
- 统计范围：活跃变更影响域命中规范链中 SHALL 与 SHALL NOT 条目总数，按目录层深归一化到 [0,1]。
- 注册进 evaluator-registry 并在 metrics types 权重表中登记默认权重。

### SHALL NOT

- SHALL NOT 将约束密度直接判定为"好/坏"质量分（密度是调节信号，质量判定归 spec-compliance / drift-score）。

### Enforcement

- ENF-1: enforced-strong(单元测试：给定固定规范链输入，断言归一化值与 rawData 明细)

## Requirement: Design→Build 一次通过率追踪

goal.md 北极星指标"Design→Build 一次通过率 ≥ 80%"必须有客观采集通道。

### SHALL

- 新增 `design-build-first-pass` evaluator：扫描归档与活跃变更的 state 工件，统计 rollback_count = 0 且 rebuild_count = 0 的变更占比，归一化 [0,1]。
- 指标仅由 CLI 代码从 state 工件推导，附带样本量（变更数）写入 rawData。

### SHALL NOT

- 禁止 LLM 自行计算或手写该指标值（与 hash 类字段同一纪律：确定性推导归代码）。

### Enforcement

- ENF-2: enforced-strong(单元测试：构造含/不含 rollback 记录的变更目录夹具，断言占比与样本量)

## Requirement: 反哺建议（advisory）

度量结果必须回流为约束强度调节建议，形成最小闭环。

### SHALL

- auto-evaluate 汇总时在报告中输出约束强度调整建议段：一次通过率低于目标（< 0.8）且约束密度高于阈值 → 建议评估放宽；反之建议评估收紧。
- 建议仅以 advisory 文本进入报告与 decisions 建议条目，标注"需人工签收后生效"。

### SHALL NOT

- 禁止自动修改 constraint_strength 配置（无人工签收不放行，红线 bp_04 同源）。
- 禁止建议逻辑绕过 evaluator 结果自行采样（建议必须引用本轮 metric 数值）。

### Enforcement

- ENF-3: enforced-strong(单元测试：低通过率+高密度夹具 → 断言建议文本含"放宽"；配置文件字节不变断言)



<!-- delta-merged from 2026-09-09-review-followup-hardening/single-source-of-truth.md -->
# Delta Spec: 二评遗留硬化（单一真相）

## Requirement: 评估器权重单一权威源

内置评估器权重必须只有一处定义，消除 map 与 defaultWeight 双源漂移。

### SHALL

- 删除 `DEFAULT_EVALUATOR_WEIGHTS` 导出常量（src/core/metrics/types.ts），确认全仓零消费者后移除。
- evaluator `defaultWeight` 属性为唯一权威源（auto-evaluate 经 MetricResult.weight 消费，现状即如此）。
- 新增不变量测试：所有内置活跃评估器（defaultWeight > 0）的权重之和 = 1（容差 1e-9）；weight=0 的调节信号（constraint-density）不参与求和但必须存在且为 0。

### SHALL NOT

- SHALL NOT 在 types.ts 或任何共享模块中保留可与之漂移的权重副本。
- SHALL NOT 引入运行时从注册表动态推导 map 的机制（评估器集合可变，动态推导无稳定语义）。

### Enforcement

- ENF-1: enforced-strong(单元测试：遍历 registerBuiltInEvaluators 后的注册表，断言权重和与调节信号存在性)

## Requirement: archive 幂等化

归档操作在部分失败后重试不得产生重复副作用。

### SHALL

- `archiveChange` 步骤顺序调整为：spec 合并/校验等只读或可重入步骤 → 目录 rename（成功即归档事实成立）→ 版本 bump / CHANGELOG / 知识提取等可观测副作用。
- `renameSync` 失败（EPERM/EXDEV）时降级为 copy+delete 回退，回退成功视为 rename 成功。
- 版本 bump 幂等：同一变更重复归档调用只 bump 一次（以变更目录内幂等标记或版本归属判定），CHANGELOG 单变更单条目。

### SHALL NOT

- SHALL NOT 在 rename 前执行版本 bump、CHANGELOG 写入、知识提取等一次性副作用。
- SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）。

### Enforcement

- ENF-2: enforced-strong(单元测试：构造 rename 失败夹具（占用目标路径），断言版本号未被 bump 且 audit 有记录；重试成功路径断言仅 bump 一次)

## Requirement: 模块注册判定标准统一

index_drift 检查与 index 构建必须采用同一模块判定标准。

### SHALL

- 判定标准统一为："目录含 `.mumuspec` 且 `.mumuspec` 内存在 prd.md 或 tech.md"。
- checker（src/guard/checker.ts index_drift 检测）与 rebuildIndexYaml（finalize-archive）双方按此标准对齐，实现上以共享的判定函数为准（禁止两处各写一份判定逻辑）。

### SHALL NOT

- SHALL NOT 仅以 `.mumuspec` 存在性判定模块（BOUNDARY-only 目录不是已注册模块）。
- SHALL NOT 在 checker 与 builder 中保留语义不一致的独立实现。

### Enforcement

- ENF-3: enforced-strong(单元测试：BOUNDARY-only 夹具目录 → checker 不再报 index_drift 且 builder 不收录；含 prd.md 夹具 → 双方均收录)



<!-- delta-merged from freedom-metrics-loop-closure/freedom-metrics-loop-closure.md -->
# Delta Spec: 自由度度量回路接通

分析见 `review/middleware-positioning-evaluation-2026-09-10.md`。

## Requirement: advisory 建议必须抵达消费者

`buildSuggestions()` 产出的约束强度调整建议必须进入可被人与 agent 读取的输出面，
不得在环节转换处被静默丢弃。

### SHALL

- `LoopEvaluation` SHALL 保留 `suggestions` 字段，由 `autoEvaluate()` 结果直传，不得在转换层丢弃。
- `MetricsSnapshot` SHALL 持久化当轮 `suggestions`，保证历史轮次建议可追溯。
- `mumuspec loop evaluate` SHALL 在建议非空时打印建议段，并标注"须人工签收后生效"。
- 建议 SHALL 经 CLI 写入变更 decisions.md 的 advisory 条目（`mumuspec decisions append`），不手工编辑。

### SHALL NOT

- SHALL NOT 存在产出物无消费者的死端（产出物与消费面必须同批交付）。

### Enforcement

- ENF-1: enforced-strong(单元测试：构造含建议的评估结果，断言 LoopEvaluation.suggestions 非空且与输入一致)
- ENF-2: enforced-strong(单元测试：断言 metrics snapshot 保留 suggestions；配置文件字节不变)

## Requirement: 自由度信号在非 loop 路径可达

goal.md 北极星指标"Design→Build 一次通过率 ≥ 80%"对全项目生效，
其度量不得只在 loop 工作流可计算。

### SHALL

- 新增只读命令 `mumuspec metrics [change] [--json]`，在任意工作流（含 full）下计算并展示指标与建议。
- 该命令 SHALL 复用既有 `Evaluator` 接口与 `evaluator-registry`，不得另建一套度量实现。
- 命令 SHALL 为纯只读：不写变更状态工件、不触发阶段转换、可安全重复执行。

### SHALL NOT

- SHALL NOT 使自由度指标仅在 loop 工作流可计算。
- SHALL NOT 因新增命令而改变既有 loop evaluate 通道的收敛语义（composite 权重与阈值不动）。

### Enforcement

- ENF-3: enforced-strong(单元测试：非 loop 变更下 `metrics` 返回约束密度与一次通过率两项)
- ENF-4: enforced-strong(单元测试：执行 `metrics` 后变更 state 文件字节不变)

## Requirement: 信号进入 agent 契约面

agent 必须能读取自由度信号，而非仅由引擎内部消费。

### SHALL

- `mumuspec metrics --json` SHALL 输出结构化字段（`metrics[]` 含 name / value / details，`suggestions[]`）供 agent 解析。
- AGENTS.md 速查 SHALL 含该入口，由命令注册表注入（单一事实源），随新增命令自动出现。

### SHALL NOT

- SHALL NOT 在 AGENTS.md 中内联指标数据（渐进式披露职责归命令与 MCP，Rules 文件受 32KiB 预算约束）。

### Enforcement

- ENF-5: enforced-strong(单元测试：`--json` 输出可解析且字段完整)
- ENF-6: enforced-weak(实跑断言：AGENTS.md 速查含 metrics 条目，全文 ≤ 32KiB)

## Requirement: 元数据事实源对齐

中间层自身的事实源不得漂移——进度类元数据同样需要一致性锁定。

### SHALL

- `docs/STATUS.md` 声明的当前包版本 SHALL 与 `package.json` 的 version 一致。
- `.mumuspec/config.yaml` 的 `ai.rules_files` SHALL NOT 含已停止生成的遗留目标（`.cursorrules` / `.windsurfrules`）。

### SHALL NOT

- SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净（兜底是防线，不是许可）。

### Enforcement

- ENF-7: enforced-strong(单元测试：断言 STATUS.md 当前包版本字符串等于 package.json version)
- ENF-8: enforced-strong(单元测试：断言 config.yaml ai.rules_files 不含遗留目标)



<!-- delta-merged from spec-lexical-channel-hygiene/spec-lexical-channel-hygiene.md -->
# Delta Spec: 约束通道与约束语义一致

## Requirement: 约束通道与约束语义一致

约束文本与其自动派生的检查通道必须同义。词法兜底通道按约束文本中的字面量在代码中检索，
字面量一旦指向被谈论的对象而非被禁止的行为，通道即失效并产生误报。

### SHALL

- 约束文本的行内代码标记 SHALL 仅用于约束实际检查的字面量（被禁止调用的 API、被禁止生成的文件名、被禁止翻越的命令行开关）。

### SHALL NOT

- SHALL NOT 以行内代码标记承载对象标识符（配置键、命令名、字段名）——词法兜底通道会把字面量出现误判为行为发生。
- SHALL NOT 为同一语义保留两条约束（重复即两条权威源，与单一权威源纪律同源）。

### Enforcement

- ENF-1: manual(设计评审核对：新增或修改 SHALL NOT 时逐条确认行内代码标记仅用于通道字面量，且不与既有约束语义重复)

