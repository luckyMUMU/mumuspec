---
# === 标识 ===
id: "KP-0026"
title: "config.yaml 核心配置 Schema 模式"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/configuration.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["configuration", "config-yaml", "schema", "setup"]
related_pages:
  - "KP-0008"
  - "KP-0019"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 需要统一的配置文件管理项目规范、变更、知识层、Agent 行为。

## config.yaml Schema

### 顶层结构

```yaml
# .mumuspec/config.yaml
version: "0.1.0"
project:
  name: "my-project"
  language: "typescript"
  framework: "nestjs"

specs:
  root: ".mumuspec"
  format: "yaml+markdown"
  max_layer_depth: 5
  auto_index: true
  require_design_doc: true

knowledge:
  enabled: true
  graph_backend: "cbm"              # cbm | cgc | builtin | none
  code_graph:
    enabled: true
    storage: "sqlite"
    auto_index_on_commit: true
  wiki:
    dir: ".mumuspec/knowledge"
    auto_extract_on_archive: true
    max_pages_per_scope: 20
  progressive_disclosure:
    max_pages_per_layer: 5
    load_stale_summary: true
  freshness:
    check_on_load: true
    warn_after_days: 90
    error_after_days: 180

enforcement:
  engine: "builtin"               # builtin | eslint | semgrep
  severity_levels: ["error", "warn", "info"]
  fail_on: "error"

changes:
  default_workflow: "full"        # full | hotfix | tweak
  require_brainstorming: true
  default_rollback_limit: 3
  default_rebuild_limit: 5
  default_build_mode: executing-plans
  default_tdd_mode: tdd
  single_active_change: true
  default_isolation: worktree

workflow:
  worktree_isolation: true
  single_active_change: true
  top_down_design: true
  tdd_enforced: true
  max_active_changes: 3           # single_active_change: false 时生效

constraint_strength:
  technical_design: high
  requirement_goals: high
  overrides:
    workflow:
      worktree_isolation: inherit   # inherit | true | false
```

### 配置优先级

1. 命令行参数（最高）
2. 环境变量 `MUMUSPEC_*`
3. 项目 `.mumuspec/config.yaml`
4. 用户 `~/.mumuspec/config.yaml`
5. 默认值（最低）

### 零配置默认

首次 `mumuspec init` 时自动生成默认 config.yaml，用户无需从零编写。

## 影响

- 项目配置与代码一起版本化管理
- 团队可共享配置，确保约束一致性
- AI Agent 根据配置动态调整行为

## 关联约束

- SHALL: `mumuspec init` SHALL 生成默认 config.yaml
- SHALL: config.yaml SHALL 可被 `mumuspec validate` 校验
- SHALL NOT: 不得在 config.yaml 中硬编码敏感信息（token/密码）
