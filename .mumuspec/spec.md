---
layer: 0
scope: "."
last_updated: "2026-09-12"
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

通道卫生说明（依「约束通道与约束语义一致」）：本节的 SHALL NOT 判定目标是"模块注册谓词是否被绕过"这一语义，
不是某个字面量是否出现。故这两条文本**不含行内代码标记**——避免派生 R2 词法通道，把"路径提及"误判为"违规"。
其强制通道为下方 ENF-3 单元测试（enforced-strong）+ manual。

### SHALL NOT

- SHALL NOT 仅凭 .mumuspec 目录的存在性判定模块（BOUNDARY-only 目录不是已注册模块）。
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


## Requirement: 设计与实现的视野正交性

"自顶向下设计，自下而上实现"按**依赖视野**（而非时间顺序）定义：
设计 Level N 时视野为 Level 0..N，实现 Level N 时视野为 Level N 及其更低层。

核心等式：**实现侧的并行度是设计侧完备性的可测量投影**——同层模块无法并行，
不是实现能力不足，而是设计未闭合。三条可判定不变量：

- I1 设计向上闭合：覆盖须无断链，反面即"断链"。
- I2 实现向下自足：只依赖本层契约与更低层，反面即"越界"。
- I3 层内默认可并行：层内模块只经冻结契约耦合，反面即"设计未闭合"。

### SHALL

- 设计 Level N 的产物 SHALL 声明其覆盖的层级，且覆盖须无断链（覆盖 N 必覆盖 0..N-1）。
- 同一 Level 的多个模块，若彼此不存在直接调用边，SHALL 归入同一并行组（parallel_group 字段）。
- 层内并行的准入条件 SHALL 为"契约已冻结 + 测试已锁定"（test_cases.design_locked 是前置条件，不是可选项）。
- 层间实现顺序 SHALL 为自下而上：低层未全部完成时，高层 SHALL NOT 被标记为 done。

### SHALL NOT

- 同层模块 SHALL NOT 依赖兄弟模块未经冻结契约导出的符号。
- 设计产物 SHALL NOT 在存在缺层的情况下被当作完备（断链即回退 Design 阶段）。

### Enforcement

- ENF-1: enforced-strong(phase-guard design_to_build：I1 覆盖断链检测 E-GUARD-009/W-GUARD-009，并将结论写入 state.design_coverage)
- ENF-2: enforced-strong(phase-guard build_to_verify 与 mumuspec state plan-parallel：同层 scope 直接调用边检测 W-BUILD-001)
- ENF-3: enforced-strong(单元测试：state layer 对同层多 scope 的歧义目标必须报错；低层未完成时必须拒绝置 done)

## Requirement: 自由度边界（设计与实现）

LLM 的实现自由度是**区间**，不是标量：上游给出约束（下界），界内的一切选择自由。

- **设计 Level N**：约束只可来自 Level 0..N-1 的规范与上层约束。本层的模块划分、接口组织、
  抽象取舍**自由**——只要不越出上层已给的约束。
- **实现 Level N**：约束只可来自**设计已声明的边界**（冻结契约、本层及更低层规范、已锁定的测试）。
  边界内的算法、数据结构、函数划分**自由**。

两个层级的自由度都遵循同一形状：**受上游约束，界内自由**。区别只在"上游"是谁——
设计的上游是更高层的规范，实现的上游是设计本身。

反面两类（机器可判定）：

- **越权约束**：一条约束没有可解析的上游来源——它不属于任何层级，是凭空发明，会压窄本应自由的空间。
- **越界实现**：实现引用了超出设计边界的符号（同层兄弟未经冻结契约导出的符号、上层内部实现）。

与前三条不变量的关系：I1（设计向上闭合）与 I2（实现向下自足）是这两道边界的可判定形式；
I3（层内默认可并行）是界内自由的推论——界内既然自由，同层模块就不存在必须串行的理由。
界内自由度的**度量**由既有 constraint-density evaluator 承担（密度越高 = 自由度越低）；
边界的**继承规则**由约束树的 tighten-only（下层可收紧、不可放宽）承担。

### SHALL

- 每条约束 SHALL 声明其上游来源（constraints.yaml 的 source_specs 字段），且每条来源 SHALL 可解析为存在的规范文件与标题。
- 设计的产物 SHALL 声明其边界：覆盖层级（state.design_coverage）与本层对外契约。
- 界内的实现选择 SHALL 仅当违反已声明边界时才被驳回。

### SHALL NOT

- SHALL NOT 存在无上游来源的约束——越权约束不属于任何层级，会凭空压窄自由空间。
- SHALL NOT 放宽上层给出的约束：下层只可收紧，不可放宽。

### Enforcement

- ENF-1: enforced-strong(constraint-provenance 检查：E-CONSTRAINT-001/002 与 W-CONSTRAINT-003，接入 mumuspec check 的 drift 数组)
- ENF-2: enforced-strong(既有边界通道：I1 E-GUARD-009/W-GUARD-009；I2 W-BUILD-001；I3 mumuspec state plan-parallel)
- ENF-3: manual(设计评审核对：界内的实现选择不得被作为缺陷驳回，仅当其违反已声明边界时才可驳回)


<!-- delta-merged from skill-plugin-standard/skill-plugin-standard.md -->
# Delta Spec: 技能插件标准与单一权威源

分析见 `review/skill-composition-audit-2026-09-12.md`。本变更把技能从"散装文件复制"改为"标准插件包分发"，
并借此消解漂移不可见、依赖不可满足、权威源多处三组缺陷。

清单规则取自宿主官方规范文档（`plugin-structure` 的 manifest-reference 与 `plugin-discovery` 的 marketplace-format），
下列条目均已改写为机器可判定的形式——先有校验器，再有产出物。

## Requirement: 技能分发符合宿主插件标准

技能集合以宿主既成的插件标准打包，使"一份源、一个版本、一次安装"成立。

- 单插件清单 SHALL 位于包根的 `.codebuddy-plugin/plugin.json`——该位置是宿主识别插件的唯一判定依据。
- 清单的 name SHALL 为 kebab-case 且匹配 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`（字母开头，字母或数字结尾，仅小写字母数字与连字符）。
- 清单的 version SHALL 为语义化版本主次修订三段式，可带预发布后缀。
- 清单的 description SHALL 为 50 至 200 字符。
- 清单的 author SHALL 为含 name 的对象（可另带 email 与 url），或等价字符串形式。
- 市场清单 SHALL 位于 `.codebuddy-plugin/marketplace.json`，含 name、owner.name、plugins 数组三项必需字段。
- 市场清单的每个插件条目 SHALL 含 name、source、description；source SHALL 为以点斜杠开头的相对路径，或为含 source 字段的对象形式。
- source 为相对路径时 SHALL 指向市场根下实际存在的目录。
- 组件路径类字段（commands / agents / hooks / mcpServers）SHALL 为以点斜杠开头的相对路径，不得含上溯段，且使用正斜杠。
- 市场条目中的 category 值 SHALL 取自宿主规范枚举（development / productivity / security / testing / database / deployment / design / monitoring / learning）。
- 包内容布局 SHALL 为 `skills/<skill-name>/SKILL.md`，使宿主无需转换即可加载。
- 包版本 SHALL 取自包版本单一源（运行时包版本），不得回退到配置文件的 schema 版本或硬编码字面量。
- 产出物 SHALL 在写出前通过清单校验器，校验器覆盖本节全部可判定条目。

### SHALL NOT

- 清单中的 source SHALL NOT 指向不存在的目录。
- 组件路径 SHALL NOT 使用绝对路径、上溯段或反斜杠。
- SHALL NOT 以自研清单格式作为分发的唯一形式——宿主无法识别的格式等于不可分发。

### Enforcement

- ENF-1: enforced-strong(单元测试：生成的插件清单逐字段比对官方规则——name 正则、version 语义化、description 长度、author 形态、必需字段集)
- ENF-2: enforced-strong(单元测试：路径正负样例——以点斜杠开头的相对路径通过；绝对路径、上溯段、反斜杠、缺前缀被拒)
- ENF-3: enforced-strong(单元测试：source 指向不存在目录时校验失败)
- ENF-4: enforced-strong(单元测试：包版本等于运行时包版本，不出现硬编码回退值)
- ENF-5: manual(发布核对：产物可被宿主插件目录直接识别)

## Requirement: 插件安装可幂等且可登记

安装动作必须留下可判定的事实，且重复执行不产生漂移。

- 安装 SHALL 落到插件缓存目录的「市场名 / 插件名 / 版本」三段布局，版本段来自包版本。
- 安装 SHALL 幂等：同一版本重复安装不得产生重复条目，也不得失败退出。
- 安装 SHALL 在宿主插件登记文件中登记或更新条目，键为「插件名@市场名」，条目含 scope、installPath、version、installedAt、lastUpdated 字段。
- 安装 SHALL 在登记文件不可写或格式不可解析时 fail-closed 并给出理由，不得静默跳过登记。
- 重复安装时 SHALL 保留首次安装时间戳，仅更新末次更新时间。

### SHALL NOT

- SHALL NOT 以占位实现返回成功——动作未实现时的正确行为是失败并给出理由。
- SHALL NOT 覆盖目标位置中非本包管理的内容。

### Enforcement

- ENF-6: enforced-strong(单元测试：两次安装后登记条目数为 1；版本段等于包版本；installedAt 不变而 lastUpdated 更新)
- ENF-7: enforced-strong(单元测试：登记文件为非法 JSON 时返回失败而非成功)
- ENF-8: enforced-weak(实跑：安装后目标路径存在清单与技能文件)

## Requirement: 技能副本漂移可检测

源与安装态之间的内容差异必须由命令而非人工发现。

- 漂移检测 SHALL 比对源技能正文与安装副本正文，并在不一致时产出诊断。
- 比对 SHALL 先剥离 frontmatter 的版本字段再比较——版本戳印会使两侧必然不同，纳入比对等于把噪声当信号。
- 诊断 SHALL 接入 `mumuspec check` 的 drift 数组与 CI 检查，作为可强制（forceable）的告警。
- 漂移检测 SHALL 对自身生效：改动任一技能正文后必须产生诊断。
- 诊断 SHALL 逐技能给出源路径与安装路径，使修复动作可定位。

### SHALL NOT

- SHALL NOT 只比对存在性而不比对内容（存在即被信任）。
- SHALL NOT 让技能源目录的高频编辑与副本之间不存在任何到期校验。

### Enforcement

- ENF-9: enforced-strong(单元测试：改动源正文产生诊断；仅改动版本行不产生诊断)
- ENF-10: enforced-strong(单元测试：漂移诊断出现在 check 的 drift 数组，且 CI 检查消费同一函数)
- ENF-11: enforced-weak(实跑：修复后 `mumuspec check` 无该诊断)

## Requirement: 技能依赖声明与可满足性一致

声明的外部能力必须可枚举、可判定，缺失不得表现为不可执行的强制项。

- 技能文本中的外部能力 SHALL 分为两类：包内自足的必须步骤，与包外增强的伴随能力。
- 伴随能力的可用性 SHALL 由代码侧探测并枚举，不得由模型现场判断。
- 伴随能力缺失 SHALL 只出现在枚举清单中，不得阻断阶段流程。
- 伴随能力的替代路径 SHALL 为带编号与产出的显式步骤，而非"降级说明"。
- 枚举结果 SHALL 经命令出口暴露，使缺失集合可被前置判断而非执行中才发现。

### SHALL NOT

- SHALL NOT 声明无实体来源的必须加载项——强断言与可满足性脱钩时，断言恒为空转。
- SHALL NOT 以静默替换代替降级留痕。

### Enforcement

- ENF-12: enforced-strong(单元测试：伴随能力枚举覆盖技能文本中声明的全部外部名称，且解析结果与实际搜索面一致)
- ENF-13: enforced-weak(实跑：伴随能力全缺失时阶段流程仍可完成并留痕)

## Requirement: 技能权威源单一

同一语义只在一处维护；技能文本不得引用引擎不存在的事实。

- 阶段分发规则 SHALL 只在一处定义，其余位置引用而非复写。
- 技能文本引用的状态字段与配置键 SHALL 存在引擎消费者。
- 技能定义 SHALL 完整存在于源目录，安装副本 SHALL 为可再生的派生物。
- 技能文本引用的 CLI 命令 SHALL 与命令注册表一致（含子命令与参数签名）。
- 引擎已实现的命令模块 SHALL 注册进命令注册表——存在模块而无注册项等于无消费者，指令与实现不得互为悬空。
- 技能文本中每条确定性步骤引用的命令 SHALL 可由命令注册表现场枚举得到，使漂移可被机械检出而非人工比对。

### SHALL NOT

- SHALL NOT 保留引擎不存在的字段名作为守卫检查项。
- SHALL NOT 让同一语义的既有正确内容在迁移中丢失。
- SHALL NOT 保留未被注册的命令模块，也不得以"有测试覆盖"代替"已接线"。

### Enforcement

- ENF-14: enforced-strong(单元测试：技能文本中不出现已知幽灵字段名；分发表定义处唯一)
- ENF-15: enforced-strong(单元测试：阶段技能的守卫目标阶段合法，取值域为状态机实际边)
- ENF-16: enforced-strong(单元测试：技能文本引用的命令及其参数签名逐条命中命令注册表——含正向样例与四类已知漂移的反向样例)
- ENF-17: enforced-strong(单元测试：命令模块集合与注册表条目集合双向闭包——有模块无注册即失败)
- ENF-18: manual(内容核对：源与副本的内容差集逐条裁决为有意变更或缺陷)

## Requirement: 技能门禁强度与风险等级一致

门禁的严厉程度必须与其所防护的风险相称。

- 每个门禁 SHALL 声明其为不可跳过，或声明可降级且降级须留痕。
- 高风险门禁（安全、代码审查、调试前置）SHALL 不得存在无条件逃逸口。
- 相邻的人工确认点 SHALL 在保持选项集不变的前提下合并为一次询问。

### SHALL NOT

- SHALL NOT 以"技能不可用"为由静默跳过高风险门禁。
- SHALL NOT 因合并询问而减少用户可选项或自动选默认值。

### Enforcement

- ENF-19: enforced-strong(单元测试：高风险门禁段落不含无条件跳过表述)
- ENF-20: manual(评审核对：合并后的确认点选项集为原选项集的并集)

