---
# === 标识 ===
id: "KP-0019"
title: "AI 工具适配层（AIToolAdapter）设计决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/design/ai-integration.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["ai-adapter", "claude", "cursor", "codex", "aitooladapter"]
related_pages:
  - "KP-0002"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

不同 AI 编程工具（Claude Code、Cursor、Codex、OpenCode）有不同的集成方式和规则格式，MumuSpec 需要适配多种工具。

## 决策

引入 AIToolAdapter 抽象层，统一 AI 工具的规范加载和行为约束：

### 适配层架构

```
MumuSpec Core
    ↓
AIToolAdapter（抽象接口）
    ↓
├── ClaudeCodeAdapter（CLAUDE.md + Skills）
├── CursorAdapter（.cursorrules + .cursor/rules/）
├── CodexAdapter（AGENTS.md）
├── OpenCodeAdapter（自定义格式）
└── CatPawAdapter（AGENTS.md + Skills）
```

### 适配内容

| 适配项 | 说明 |
|--------|------|
| **规范加载** | 将 spec.md 约束转换为工具可理解的 Rules 文件 |
| **渐进式披露** | 按当前编辑文件路径加载相关规范上下文 |
| **工作流感知** | 检测活跃变更阶段，提供对应阶段约束 |
| **知识注入** | 将 .mumuspec/knowledge/ 中的确认决策注入提示上下文 |

### Rules 文件生成

```markdown
# CLAUDE.md（自动生成）

## 约束加载
- SHALL 使用 `mumuspec context <path>` 获取当前目录规范
- SHALL NOT 修改已锁定的 test-cases/ 或 suite-map.yaml

## 当前项目规范摘要
- 正向要求：所有 API 返回统一 JSON 格式
- 反向禁止：禁止明文存储密码
```

### 自动检测

| 检测项 | 说明 |
|--------|------|
| 项目初始化检测 | 自动检测 .mumuspec/ 是否存在 |
| 活跃变更检测 | 检测是否有进行中的变更 |
| 规范漂移检测 | 代码提交时自动检测规范漂移 |
| 知识可用性检测 | detect 知识层后端是否可用 |

## 影响

- AI 开发者无需手动加载规范（自动适配）
- 同一项目可被多种 AI 工具使用（规范统一）
- Tool Adapter 可通过插件机制扩展

## 关联约束

- SHALL: AIToolAdapter SHALL 支持至少 3 种主流 AI 工具（Claude Code / Cursor / Codex）
- SHALL NOT: Adaptor SHALL NOT 修改项目规范文件，仅读取
- SHALL: 适配层 SHALL 在知识层降级时仍正常工作
