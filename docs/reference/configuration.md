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
  # --- 代码图谱 ---
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
  default_tdd_mode: tdd           # 固定为 tdd，不可配置为 direct

  # 工作流规则（硬性约束）
  single_active_change: true      # 固定为 true，不可关闭
  default_isolation: worktree     # worktree | branch
  allow_isolation_downgrade: true # 允许降级为 branch（需记录原因）

  # 硬性规则只读校验项（不可配置，仅用于 CI 校验）
  implementation_strategy: bottom-up  # 固定值
  design_strategy: top-down       # 固定值
  tdd_mode: tdd                   # 固定值
  test_immutability: true         # 固定值

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
    - "CLAUDE.md"
    - ".cursorrules"
    - "AGENTS.md"

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

> **导航**: [← MCP 工具](mcp-tools.md) | [Phase Guard →](phase-guards.md) | [返回概览](../overview.md)
