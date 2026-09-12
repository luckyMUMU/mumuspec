# 配置参考

> 层级: Level 2 参考文档

---

## 完整 config.yaml

```yaml
# .mumuspec/config.yaml

version: "0.1.0"
project:
  name: "my-project"
  language: "typescript"          # 主语言
  framework: "nestjs"             # 主框架

# 规范配置
specs:
  root: ".mumuspec"               # 根规范目录
  format: "yaml+markdown"         # 规范格式
  max_layer_depth: 5              # 最大规范层级深度
  auto_index: true                # 自动生成 index.yaml
  require_design_doc: true        # 每个有 spec.md 的目录必须维护 design.md

# 代码图谱配置
knowledge:
  enabled: true
  # --- 代码图谱后端选择 ---
  graph_backend: "cbm"              # cbm | cgc | builtin | none
  graph_backend_config:
    cbm:
      server_url: "http://localhost:3000"
    cgc:
      graph_db: "neo4j"
      connection_string: "bolt://localhost:7687"
    builtin:
      max_files: 10000
  # --- 代码图谱（builtin 后端配置） ---
  code_graph:
    enabled: true
    storage: "sqlite"               # sqlite | memory
    db_path: ".mumuspec/graph/index.db"
    auto_index_on_commit: true
    languages: ["typescript", "javascript"]
  # --- LLM-Wiki ---
  wiki:
    dir: ".mumuspec/knowledge"
    auto_extract_on_archive: true   # Archive 时自动提取知识
    max_pages_per_scope: 20         # 每个代码范围最大知识页面数
  # --- 渐进式加载 ---
  progressive_disclosure:
    max_pages_per_layer: 5          # 渐进式加载每层最大页面数
    load_stale_summary: true        # 是否加载过期页面的摘要
  # --- 新鲜度管理 ---
  freshness:
    check_on_load: true             # 加载时检查新鲜度
    warn_after_days: 90             # 90 天未验证标记为 stale
    error_after_days: 180           # 180 天未验证标记为 unverified
  # --- 漂移检测 ---
  drift_detection: true             # 知识漂移检测

# 校验配置
enforcement:
  engine: "builtin"               # builtin | eslint | semgrep
  eslint_config: ".eslintrc.json"
  severity_levels: ["error", "warn", "info"]
  fail_on: "error"

# 变更配置
changes:
  default_workflow: "full"        # full | hotfix | tweak
  require_brainstorming: true
  auto_transition: true

  # 实例层默认值
  default_rollback_limit: 3       # rollback_count 上限
  default_rebuild_limit: 5        # rebuild_count 上限
  default_build_mode: executing-plans  # executing-plans | subagent | direct
  default_tdd_mode: tdd           # 默认 tdd，可通过 workflow.tdd_enforced 关闭强制

  # 工作流规则（可配置约束，详见 workflow.* 配置）
  single_active_change: true      # 默认 true，可通过 workflow.single_active_change 关闭
  default_isolation: worktree     # worktree | branch
  allow_isolation_downgrade: true # 允许降级为 branch（需记录原因）

  # 规则校验项默认值（可通过 workflow.* 配置覆盖）
  implementation_strategy: bottom-up  # 默认值，可配置
  design_strategy: top-down       # 默认值，可配置
  tdd_mode: tdd                   # 默认值，可配置
  test_immutability: true         # 默认值，可配置

# 工作流规则配置（四大工作流约束）
# 字面默认值仅为 getDefaultConfig() 初始取值；有效值由 resolveWorkflowRule() 求出
# （显式 override > 强度矩阵 > 回退 true）。默认 technical_design: medium
# → top_down_design / tdd_enforced 有效值为 false。
workflow:
  worktree_isolation: true        # 字面默认 true；RG=high 时有效值为 true
  single_active_change: true      # 字面默认 true；RG=high 时有效值为 true
  top_down_design: false          # 字面默认 false；TD=high 时有效值为 true
  tdd_enforced: false             # 字面默认 false；TD=high 时有效值为 true
  max_active_changes: 3           # 仅当 single_active_change: false 时生效

# 动态约束强度配置（0.12.0 新增）
# 详见 docs/design/constraint-strength.md
constraint_strength:
  # 双维度强度等级 — 独立可配置
  technical_design: high          # high | medium | low  — HOW 维度（设计/实现严谨度）
  requirement_goals: high         # high | medium | low  — WHAT 维度（需求目标完整度）

  # 例外清单（只读，不可关闭，不论强度等级始终 high/block）
  exceptions:
    - archive_terminal_state          # archive-completed 终态守卫
    - discard_user_confirmation       # AI 不能自动 Discard
    - commit_sha_immutability         # git_merge.commit_sha 不可篡改
    - sensitive_info_scan             # 安全/敏感信息扫描
    - shall_not_violation_in_ci       # SHALL NOT 违规在 CI 阶段始终阻断
    - bp_03_user_confirmation         # BP-3 工件审查
    - bp_04_design_confirmation       # BP-4 设计方案确认
    - bp_14_verify_failure            # BP-14 验证失败处理
    - bp_17_archive_confirmation      # BP-17 归档最终确认

  # 显式覆盖（高级用户，优先级高于强度等级）
  # 值为 inherit 时按 strength 等级求值；其他值显式覆盖
  overrides:
    workflow:
      worktree_isolation: inherit       # inherit | true | false
      single_active_change: inherit
      top_down_design: inherit
      tdd_enforced: inherit
    cognitive_framework: inherit        # inherit | required | optional | off
    hyperplan: inherit                  # inherit | required | conditional | off
    brainstorming: inherit              # inherit | required | lightweight | off
    test_immutability: inherit          # inherit | strict | design_only | off
    impact_analysis: inherit            # inherit | required | recommended | off

# 规范优先级模式（A-08 假设降级方案）
priority_mode: "shall_not_first"  # shall_not_first | shall_first | equal

# CI/CD 配置
ci:
  pre_commit_check: "shall-not"
  test_immutability_check: true
  full_check_on_push: true
  drift_detection_on_pr: true

# AI 集成
ai:
  generate_rules: true
  mcp_server: true
  rules_files:
    - "AGENTS.md"                  # canonical（唯一权威规则文件）
    - "CLAUDE.md"                  # 薄壳桥接（首行 @AGENTS.md）
    - "GEMINI.md"                  # 薄壳桥接（首行 @AGENTS.md）
  # 注: 0.20 起停止生成 .cursorrules / .windsurfrules（C3 遗留格式禁令）

# Skill 生态集成
skills:
  enabled: true
  discovery: auto                 # auto | manual
  ecosystems:
    superpowers:
      enabled: true
      path: "~/.claude/skills"
      dispatch_mode: deep
    agent_skills:
      enabled: true
      path: "~/.agents/skills"
      dispatch_mode: deep
    comet:
      enabled: true
      path: "~/.claude/skills/comet"
      dispatch_mode: interop
    custom:
      enabled: true
      path: ".mumuspec/skills/custom"
  dispatch:
    required_skill_missing: block # block | skip | warn（仅影响 optional Skill）
    shall_violation: block        # block | warn
    shall_not_violation: block    # 固定 block，不可配置
    skill_timeout: 300s
    parallel_dispatch: false
  hyperplan:                      # 0.7.0 新增
    enabled: true
    critic_count: 5               # 固定 5，不可调整
    categories:
      skeptic: "unspecified-low"
      validator: "unspecified-high"
      researcher: "deep"          # 不可用时降级为 4 角色
      architect: "ultrabrain"
      creative: "artistry"
    max_rounds: 3                 # 固定 3，不可减少
    mandatory_planner_handoff: true  # 固定 true
    trigger_conditions:
      min_affected_scopes: 3
      on_new_shall_not: true
      workflows: ["full"]

# 契约层配置（0.8.0 新增）
contracts:
  enabled: true
  external_dir: "contracts/external"
  outbound_dir: "contracts/outbound"
  schemas_dir: "contracts/schemas"
  registry_file: "contracts/_registry.yaml"
  auto_derive: true               # 自动注入派生约束到 spec.md
  drift_detection: true
  compat_check_on_change: true
  verify_on_build: true
  verify_on_archive: true

# Ponytail 基础编码约束（0.10.0 新增）
ponytail:
  enabled: true                     # 启用 Ponytail 7 级优先级阶梯
  auto_inject_to_root: true         # 自动注入到根层 spec.md
  comment_marker: "ponytail:"       # 有意简化标记
  strict_no_new_deps: true          # 严格禁止引入不必要的新依赖

# 认知框架配置（0.8.0 新增）
cognitive_framework:
  enabled: true                   # full 工作流自动启用
  default_mode: full              # full | incremental
  max_rounds: 5                   # Stage 2+3 合计上限
  q3_per_round: 3                 # 每轮 Q3 推导上限
  q2_per_round: 5                 # 每轮 Q2 提问上限
  q4_min_dimensions: 3            # Q4 最少扫描维度
  hotfix_skip: true               # hotfix/tweak 跳过认知框架

# 设计文档配置
design_docs:
  enabled: true
  required: true
  auto_sync_on_design_phase: true
  drift_detection: true
  inheritance: true

# 文档生成配置
docs:
  enabled: true
  output_dir: "docs"
  generation:
    auto_on_build: true
    auto_on_archive: true
    stale_detection: true
    context_aggregation_depth: -1  # -1=全部父层, 0=仅当前层, N=向上N层
  types:
    technical:
      enabled: true
      output_dir: "docs/technical"
      include_enforcement: true
      include_adr: true
    business:
      enabled: true
      output_dir: "docs/business"
      simplify_language: true
      include_user_flow: true
    integration:                  # 0.8.0 新增
      enabled: true
      output_dir: "docs/integration"
      source: "contracts/outbound"
      include_schemas: true
      include_changelog: true
    dependencies:                 # 0.8.0 新增
      enabled: true
      output_dir: "docs/dependencies"
      source: "contracts/external"
      include_call_policies: true
      include_degradation: true
  templates:
    custom_dir: ".mumuspec/templates"
    fallback_to_builtin: true
  output:
    default_format: markdown      # markdown | html | pdf | confluence
    formats:
      - markdown
  consistency_check:
    enabled: true
    on_pr: true
    auto_regen_on_drift: true
    block_on_manual_edit: true
```

---

## 知识层配置

### knowledge.graph_backend

**类型**: string
**默认值**: `"cbm"`
**可选值**: `"cbm"` | `"cgc"` | `"builtin"` | `"none"`

代码图谱后端选择:
- `"cbm"`: 集成 codebase-memory-mcp(默认,158 语言支持)
- `"cgc"`: 集成 CodeGraphContext(23+ 语言,5 种图数据库)
- `"builtin"`: 内置简化版 tree-sitter + SQLite(仅 TS/JS,降级用)
- `"none"`: 关闭代码图谱,仅使用 Spec Layer

```yaml
knowledge:
  graph_backend: "cbm"
  graph_backend_config:
    cbm:
      server_url: "http://localhost:3000"
    cgc:
      graph_db: "neo4j"
      connection_string: "bolt://localhost:7687"
    builtin:
      max_files: 10000
```

当选择 `"cbm"` 或 `"cgc"` 时,MumuSpec 自动检测外部工具安装状态,不可用时降级为 `"builtin"` 并在 `mumuspec status` 中标注降级状态与能力边界。

---

## 工作流配置

### workflow.*

**类型**: object
**默认值**: `worktree_isolation`/`single_active_change` 字面 `true`；`top_down_design`/`tdd_enforced` 字面 `false`

> **口径澄清（2026-09-12）**：`workflow.*` 的字面默认值不是有效值。有效值由
> `resolveWorkflowRule()` 按"显式 override > 强度矩阵 > 回退 `true`"求出，矩阵见
> `src/core/config-tree.ts` 的 `WORKFLOW_STRENGTH_MATRIX`。默认 `technical_design: medium`
> 下 `top_down_design` 与 `tdd_enforced` 的有效值为 `false`（此前本文档误称"默认 true"）。

```yaml
workflow:
  worktree_isolation: true        # 字面默认 true
  single_active_change: true      # 字面默认 true（关闭后允许 N 个并行变更,上限默认 3）
  top_down_design: false          # 字面默认 false；TD=high 时有效值为 true
  tdd_enforced: false             # 字面默认 false；TD=high 时有效值为 true
```

#### workflow.worktree_isolation

- **默认值**: `true`
- **关闭行为**: 跳过 Worktree 隔离检查,变更在主分支工作目录中进行
- **关闭时 WARN**: "已关闭 Worktree 隔离,变更将影响主分支工作目录"

#### workflow.single_active_change

- **默认值**: `true`
- **关闭行为**: 允许同时多个活跃变更(上限默认 3,可通过 `workflow.max_active_changes` 配置)
- **关闭时 WARN**: "已关闭单一活跃变更,可能影响变更隔离性"
- **相关配置**: `workflow.max_active_changes: 3`(仅当 `single_active_change: false` 时生效)

#### workflow.top_down_design

- **默认值**: `false`（字面值；有效值由 TD 强度决定——`high`→`true`，`medium`/`low`→`false`）
- **开启行为**: I1 设计覆盖断链 → **阻塞**（`E-GUARD-009`）
- **关闭行为**: 设计覆盖断链降级为恒可见告警（`W-GUARD-009`），**不跳过检查**；
  三种强度下均写入结构化事实 `state.design_coverage`，不存在"关闭即静默"的状态
- **相关命令**: `mumuspec state layers <name>`（层级与并行组视图）


#### workflow.tdd_enforced

- **默认值**: `true`
- **关闭行为**: TDD 强制降级为可选,仅要求"测试存在但不强制红绿循环"
- **关闭时 WARN**: "已关闭 TDD 强制,仅要求测试存在"

> **与 constraint_strength 的关系**: `workflow.*` 配置项若显式设置（非 `inherit`）,优先级高于 `constraint_strength` 强度等级。未设置（或值为 `inherit`）时按 `constraint_strength.overrides.workflow.*` 求值,若仍为 `inherit` 则按对应维度的 `constraint_strength.technical_design` / `requirement_goals` 强度等级求值。

---

## 工作流覆盖（`.mumuspec/workflow.yaml`）

> **CHG-7 新增**。项目级覆盖流程定义：自定义阶段边 / 阻塞点 / 条件 / workflow 序列，无需改代码。默认不配置时行为与内置默认完全一致。

### 位置与优先级

| 配置来源 | 路径 | 优先级 |
|---------|------|--------|
| 项目级覆盖 | `.mumuspec/workflow.yaml`（与 `config.yaml` 同级） | **高**（存在且有效时生效） |
| 内置默认 | 包内 `workflow.default.yaml`（只读） | 低（兜底） |

### 格式与整体替换语义

项目级文件是**完整 `WorkflowConfig`**，与内置默认同构，**整体替换**（`edges` / `workflows` 全量），**不支持增量合并**（如只想改一条边，须复制内置定义后修改，再整体写入）。

```yaml
# .mumuspec/workflow.yaml
version: 1

phases:
  - open
  - design
  - build
  - verify
  - archive-in-progress
  - archive-completed
  - discarded

terminal:
  - archive-completed
  - discarded

edges:
  # forward（progress）
  - { from: open, to: design, direction: forward, countAs: none, label: open→design（完整工作流）, bp: { id: BP-3, description: 工件审查与确认, required: true } }
  - { from: design, to: build, direction: forward, countAs: none, label: design→build, bp: { id: BP-4, description: 设计方案确认, required: true } }
  - { from: build, to: verify, direction: forward, countAs: none, label: build→verify }
  # …其余边参考内置默认（`src/change/workflow.default.yaml`），此处省略…
  # skip（conditional shortcut）
  - { from: open, to: build, direction: skip, countAs: none, label: open→build（hotfix/tweak 跳过 design）, condition: { workflow_in: [hotfix, tweak] } }
  # backward（rollback/rework）
  - { from: build, to: design, direction: backward, countAs: rollback, label: build→design（回退重设） }
  # terminal（discarded）
  - { from: open, to: discarded, direction: skip, countAs: none, label: open→discarded（废弃变更） }

workflows:
  full:  { phases: [open, design, build, verify, archive-in-progress, archive-completed] }
  hotfix: { phases: [open, build, verify, archive-in-progress, archive-completed], skip_design: true }
  tweak: { phases: [open, build, verify, archive-in-progress, archive-completed], skip_design: true }
  loop:  { phases: [build, verify, archive-in-progress, archive-completed] }
```

字段规则（与内置校验一致）：

| 字段 | 规则 |
|------|------|
| `version` | 必须为 `1` |
| `phases` | 必须等于内置 `PHASE_ORDER`（open→discarded，7 个，顺序一致） |
| `terminal` | 必须是已知阶段（默认 `archive-completed` / `discarded`） |
| `edges[].from/to` | 必须是已知阶段；`direction` ∈ `forward|backward|skip`；`countAs` ∈ `rollback|rebuild|none`；`label` 非空 |
| `edges[].bp` | 可选；`id` 非空、`description` 字符串、`required` 布尔 |
| `edges[].condition` | 可选；本期仅支持 `workflow_in`（非空、均为已知 workflow） |
| `workflows` | 必须**恰好**包含 `full`/`hotfix`/`tweak`/`loop` 四个键，不得有未知键；phases 必须均为已知阶段 |

### 边移除的语义

项目级通过"删边"实现自定义，但需注意柔性边算法：

- 移除**非终态 → 非终态**的显式边（如 `design→build`）：显式边及其阻塞点（BP-4）消失，`requiresUserConfirmation` 不再要求确认；但转换仍可达——系统会合成**柔性边**（无 BP、`countAs: none`）。
- 移除**指向终态**的边（如 `archive-in-progress→archive-completed`）：转换**真正被禁**（`E-CHANGE-006`），因为终态目标无柔性边兜底。

> 若需彻底禁用某条非终态转换，可配合调整 `terminal`（将目标设为终态）——但这会改变终态判定，请谨慎使用。

### 校验与回退（fail-safe）

加载遵循 CHG-6 的 fail-safe 风格，任何异常都不会中断变更操作：

| 场景 | 行为 |
|------|------|
| 文件不存在 | 静默回退内置默认（无 WARN） |
| YAML 解析失败（损坏） | `console.warn`（含路径 + 原因）+ 回退内置默认 |
| 校验失败（未知 phase / 非法 direction / 缺 workflows 键等） | `console.warn`（注明具体原因）+ 回退内置默认 |

WARN 示例：

```
[phase-graph-loader] project workflow config invalid at /path/.mumuspec/workflow.yaml: edges[0].to must be a known phase; falling back to built-in default workflow config
```

### 生效时点

- CLI / MCP 在每次变更操作（`state transition` / `state next` / `state graph` / `guard --apply` / MCP `get_change_status`）开始时加载一次项目级配置。
- **不做进程内热更新**：修改 YAML 后，下一次命令（或下一个 MCP 请求）生效。

---

## 动态约束强度配置

### constraint_strength.*

**类型**: object
**默认值**: `{ technical_design: high, requirement_goals: high }`

双维度约束强度系统,支持三档强度（high / medium / low）按"技术设计"和"需求目标"两个维度独立配置。详见 [动态约束强度系统设计](../design/constraint-strength.md)。

> **0.12.1+ 树状层级**：`constraints.yaml` 按目录树分层存放,子层继承父层约束可**收紧**不可**放宽**,同 ID 冲突时**高层级优先**。`config.yaml: constraint_strength.*` 作为根层强度回退值;子层 `constraints.yaml: strength.*` 可覆盖本层及子层强度。详见 [§5.6 树状层级与继承](../design/constraint-strength.md#56-树状层级与继承0121)。

```yaml
constraint_strength:
  technical_design: high         # high | medium | low
  requirement_goals: high        # high | medium | low
  exceptions: [...]              # 只读例外清单
  overrides:                     # 显式覆盖,优先级高于强度等级
    workflow:
      worktree_isolation: inherit
      single_active_change: inherit
      top_down_design: inherit
      tdd_enforced: inherit
    cognitive_framework: inherit
    hyperplan: inherit
    brainstorming: inherit
    test_immutability: inherit
    impact_analysis: inherit
```

#### 与 constraints.yaml 树状强度的关系

| 配置位置 | 作用范围 | 优先级 |
|---------|---------|--------|
| `config.yaml: constraint_strength.*` | 全项目根层强度回退 | 最低（根层缺省时使用） |
| `.mumuspec/constraints.yaml: strength.*`（根层） | 本层及未覆盖的子层 | 高于 config.yaml |
| `src/.mumuspec/constraints.yaml: strength.*`（子层） | 本层及未覆盖的子层 | 高于父层（必须 ≥ 父层） |
| `constraint_strength.overrides.*`（config.yaml） | 显式覆盖强度等级 | 最高（仅在同一层内） |

子层 `strength.<dim>` 缺省时继承父层;显式设置时必须 ≥ 父层,否则忽略并 WARN。

### constraint_strength.technical_design

**类型**: string
**默认值**: `"high"`
**可选值**: `"high"` | `"medium"` | `"low"`

技术设计维度（HOW）的约束强度,控制以下约束项的执行力度:

| 约束项 | high | medium | low |
|--------|------|--------|-----|
| design.md 完整性 | 必需,覆盖所有 affected 层级 | 必需,至少根层 + 受影响层 | 可选 |
| 自顶向下设计顺序（I1 断链） | 强制 Level 0→N（阻塞） | 仅 WARN 且恒可见 | 不阻断（仍写 design_coverage） |
| 认知框架 Q1-Q4 | 强制 5 轮收敛,Q4 ≥3 维度 | 可选,最多 3 轮 | 关闭 |
| Hyperplan 对抗审查 | 触发即执行,5 critic + 3 round | 用户显式触发,3 critic + 1 round | 关闭 |
| 代码图谱验证 | 必需 | 推荐 | 关闭 |
| Ponytail 编码约束 | 强制 7 级 + strict_no_new_deps | 仅 YAGNI + 复用检查 | 关闭 |
| build_layers 计划 | 必需,多层 | 必需,单层即可 | 可选 |
| 测试用例设计 | 每层 cases.md + design_locked | 至少 layer-0 + design_locked | 可选 |
| 测试套件锁定 | suites_hash 全程锁定 | 仅 design_locked | 关闭 |
| TDD 红绿循环 | 强制 Red→Green→Refactor | 测试存在即可 | 关闭 |

### constraint_strength.requirement_goals

**类型**: string
**默认值**: `"high"`
**可选值**: `"high"` | `"medium"` | `"low"`

需求目标维度（WHAT）的约束强度,控制以下约束项的执行力度:

| 约束项 | high | medium | low |
|--------|------|--------|-----|
| proposal.md 完整性 | 必需: 目标/非目标/范围/影响/验收 | 必需: 目标/范围/影响 | 简要描述 |
| Brainstorming 深度 | 必需多轮,含选项式 Q&A | 必需,单轮即可 | 可选 |
| delta-specs/ | 必需 SHALL + SHALL NOT | 必需 SHALL | 可选 |
| 影响分析 | 必需 gitnexus-impact-analysis | 推荐 | 关闭 |
| 历史知识加载 | 必需 mumuspec knowledge context | 推荐 | 关闭 |
| 契约兼容检查 | 必需 mumuspec contract compat-check | 推荐 | 关闭 |
| 用户确认门禁 | 全部 18 个 BP 阻塞点 | 仅 BP-3/4/8/14/17 | 仅 BP-17 |
| decisions.md | 每阶段 ≥1 条 + content_hash | 每阶段 ≥1 条 | 可选 |
| 单一活跃变更 | 强制 1 个 | 软警告 ≤3 并行 | 关闭 |
| Worktree 隔离 | 强制 | 推荐 branch 降级 | 关闭 |

### constraint_strength.exceptions

**类型**: string[]（只读）
**默认值**: 内置 9 项例外

不论强度等级始终 `block` 的约束清单,用户 **不可关闭**。包含: `archive_terminal_state` / `discard_user_confirmation` / `commit_sha_immutability` / `sensitive_info_scan` / `shall_not_violation_in_ci` / `bp_03_user_confirmation` / `bp_04_design_confirmation` / `bp_14_verify_failure` / `bp_17_archive_confirmation`。

### constraint_strength.overrides

**类型**: object
**默认值**: 全部 `inherit`

显式覆盖强度等级,优先级: `overrides.*` > `strength.*` > 默认值。每个覆盖项支持 `inherit`（按强度等级求值）或具体值（如 `true | false` / `required | optional | off`）。

### 强度等级语义

| 强度 | 阻断行为 | 适用场景 |
|------|---------|---------|
| `high` | Pre-commit / Phase Guard 阻断（block） | 新项目、关键系统、团队不熟 |
| `medium` | 输出 WARN,记录到 decisions.md,不阻断 | 成熟项目常规迭代 |
| `low` | 输出 INFO,仅在 verify.md 汇总 | 紧急修复、原型探索、教学 |

### 预设强度组合

通过 `mumuspec constraints preset <name>` 命令快速设置:

| 预设 | TD | RG | 场景 |
|------|----|----|------|
| `strict` | high | high | 新项目 / 关键系统（默认） |
| `balanced` | medium | medium | 成熟项目常规迭代 |
| `hotfix` | low | high | 紧急 hotfix（保需求,省技术流程） |
| `exploratory` | medium | low | 探索性原型 |
| `minimal` | low | low | 教学 demo / 一次性脚本 |

### config enable/disable 命令支持

```bash
# 查看当前约束强度
mumuspec constraints strength

# 设置约束强度
mumuspec constraints strength --td high --rg medium

# 单次变更覆盖
mumuspec constraints strength --change <name> --td low --rg medium

# 应用预设
mumuspec constraints preset balanced

# 初始化持久化约束文件 constraints.yaml
mumuspec constraints init

# 从 spec.md 同步约束到 constraints.yaml
mumuspec constraints sync

# 列出所有约束
mumuspec constraints list --dimension td
mumuspec constraints list --type shall-not

# 添加自定义约束
mumuspec constraints add --dimension td --type shall-not \
  --content "禁止使用 var 关键字" --min-strength medium

# 验证当前变更是否满足约束
mumuspec constraints check --change <name>
```

---

## 规范优先级配置

### priority_mode

**类型**: string
**默认值**: `"shall_not_first"`
**可选值**: `"shall_not_first"` | `"shall_first"` | `"equal"`

规范优先级体系模式:
- `"shall_not_first"`: SHALL NOT 优先(默认,SHALL NOT 约束优先级高于 SHALL)
- `"shall_first"`: SHALL 优先(降级方案,团队不接受 SHALL NOT 优先时使用)
- `"equal"`: SHALL 与 SHALL NOT 平等(无优先级)

```yaml
priority_mode: "shall_not_first"
```

此配置项是 A-08 假设的降级方案:当团队不接受 SHALL NOT 优先时,可切换为 `"shall_first"` 模式。

---

## 零配置默认

MumuSpec 定义"零配置默认"配置,新用户无需理解全部即可启动。`mumuspec init` 使用零配置默认值,所有高级特性默认关闭。

### 默认开启的特性

| 特性 | 默认配置 | 说明 |
|------|---------|------|
| Spec Layer | 开启 | 树状规范 + SHALL/SHALL NOT + 渐进式披露 |
| Change Layer(基础) | 开启 | 五阶段状态机 + 基础回退 |
| Guard Layer(P0) | 开启 | Pre-commit SHALL NOT 检查 + spec_drift |
| Rules 文件生成 | 开启 | AGENTS.md（canonical）+ CLAUDE.md/GEMINI.md 薄壳桥接 |
| AI 工具适配层 | 开启(自动检测) | 自动检测当前 AI 工具 |
| 动态约束强度 | 开启（`balanced` 预设） | TD=medium, RG=medium;可通过 `mumuspec constraints preset` 切换 |
| 持久化 constraints.yaml | 开启 | `mumuspec init` 自动初始化空约束清单 |

### 默认关闭的特性

| 特性 | 默认配置 | 开启方式 |
|------|---------|---------|
| Ponytail 编码约束 | 关闭 | `mumuspec config enable ponytail` |
| 认知框架 Q1-Q4 | 关闭 | `mumuspec config enable cognitive-framework` |
| Contract Layer | 关闭 | `mumuspec config enable contract-layer` |
| Knowledge Layer 代码图谱 | 关闭 | `mumuspec config enable knowledge-graph`(需配置后端) |
| TDD 强制 | 开启(可关闭) | `workflow.tdd_enforced: false` 关闭 |
| Skill Bridge | 关闭 | `mumuspec config enable skill-bridge` |
| Hyperplan | 关闭 | `mumuspec config enable hyperplan` |
| `strict` 强度预设 | 关闭（默认 balanced） | `mumuspec constraints preset strict` |

### config enable/disable 命令

```bash
# 开启特性
mumuspec config enable <feature>

# 关闭特性
mumuspec config disable <feature>

# 查看当前配置
mumuspec config list
```

支持的 feature 名称:
- `ponytail` - Ponytail 编码约束
- `cognitive-framework` - 认知框架 Q1-Q4
- `contract-layer` - Contract Layer
- `knowledge-graph` - Knowledge Layer 代码图谱(需配合 `knowledge.graph_backend` 配置)
- `skill-bridge` - Skill Bridge 兼容层
- `hyperplan` - Hyperplan 对抗式规划

### 新用户零配置启动流程

1. 运行 `mumuspec init`,全部使用默认值
2. 项目仅启用 Spec/Change/Guard P0/Rules 四个核心模块
3. 高级特性默认关闭
4. `mumuspec status` 显示"高级特性未启用,使用 config enable 开启"

---

> **导航**: [← MCP 工具](mcp-tools.md) | [Phase Guard →](phase-guards.md) | [返回概览](../overview.md)
