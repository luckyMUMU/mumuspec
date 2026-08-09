# MumuSpec 知识持久化改进方案

> 创建日期: 2026-08-08
> 最后更新: 2026-08-08（v2：升级为双向传递 + 对话式兜底）
> 状态: Draft
> 参考来源: [TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)

---

## 1. 定位声明

### 1.1 本文讨论范围

本文讨论 **MumuSpec 自身的知识持久化** —— 即 `.mumuspec/knowledge/` 目录下的决策、模式、教训、风险等条目的采集、存储、检索、治理，以及与外部 agent 之间的 **双向知识传递**。

### 1.2 兼容性边界

**MumuSpec 不走"通用记忆格式"路线。**

原因：
- 主流 agent（Claude Code / Cursor / Windsurf / Continue / Copilot）的记忆结构差异巨大，无法设计一个通用格式同时满足各家
- 强行兼容意味着每家都只能用到最小公倍数，丢失 MumuSpec 自身的 L0-L3 语义金字塔、图谱绑定、契约溯源等核心能力
- 与任意 agent 的记忆系统深度兼容 = 维护 N 套适配器 = 高耦合、高维护成本

### 1.3 双向传递策略

```
                  ┌───────────────────────────┐
                  │     MumuSpec Knowledge      │
                  │     (L0-L3 语义金字塔)       │
                  └─────────────┬───────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 │                 ▼
     ┌────────────────┐         │        ┌────────────────┐
     │   Export       │         │        │    Import      │
     │  推送至 agent   │         │        │  从 agent 吸收  │
     └───────┬────────┘         │        └───────┬────────┘
             │                  │                │
     ┌───────┴───────┐         │        ┌───────┴───────┐
     │               │         │        │               │
     ▼               ▼         │        ▼               ▼
┌─────────┐   ┌──────────┐     │  ┌──────────┐   ┌──────────────┐
│ Direct  │   │ Skill    │     │  │ Direct   │   │ Conversation │
│ Export  │   │ Export   │     │  │ Import   │   │ Import       │
│(文件生成)│   │(对话推送) │     │  │(文件解析) │   │(对话提取)     │
└─────────┘   └──────────┘     │  └──────────┘   └──────────────┘
```

**原则**
- ✅ MumuSpec 知识 **可推送** 给主流 agent（export / skill 对话）
- ✅ 主流 agent 知识 **可吸收** 进 MumuSpec（direct parse / 对话提取）
- ✅ 两者**不是镜像同步**，各保持独立存储与格式
- ✅ 对于**不支持直接文件读写的 agent**，通过定制 skill 以对话方式完成双向传递
- ❌ 不做实时双向同步（避免循环冲突与维护复杂度）
- ❌ 不改变 MumuSpec 内部存储结构以迎合外部格式

---

## 2. 现状分析

### 2.1 当前知识库结构

```
.mumuspec/knowledge/
├── _index.yaml              # 主索引（id/title/type/status/scope/file/tags/related）
├── _reverse-index.yaml      # 反向索引（哪些页面引用了当前页面）
├── decisions/               # 决策（global / change / imported 三级 scope）
├── patterns/                # 模式
├── lessons/                 # 教训
├── rationale/               # 原理
├── risks/                   # 风险
├── scenarios/               # 场景块（L2 聚合，尚未启用）
├── imports/                 # 从外部源导入的文档（只读缓存）
├── templates/               # 知识条目模板
└── _metrics.yaml            # 使用度量（尚未启用）
```

### 2.2 当前条目格式（frontmatter schema）

```yaml
---
id: "KP-0001"
title: "..."
type: decision | pattern | lesson | rationale | risk | scenario
status: confirmed | draft | archived
scope: global | <change-name> | imported
level: L0 | L1 | L2 | L3         # 新增：语义层级
scenario: "<scenario-id>"          # 新增：L2 场景聚合键
created_at: ISO8601
updated_at: ISO8601
verified_at: ISO8601
source_change: "<change-name>"
source_phase: design | build | verify | archive
source_artifact: "<file>"
source_agent: "claude"             # 新增：从哪个 agent 导入（如有）
graph_bindings:
  - src/core/types.ts
tags: ["...", "..."]
related_pages:
  - "KP-0002"
backward_refs: []
cognitive_origin:
  quadrant: Q1|Q2|Q3|Q4
  reasoning_chain: []
  confidence: high|medium|low
---
```

### 2.3 识别的改进点

| 编号 | 差距 | 影响 |
|------|------|------|
| G1 | 无语义金字塔（所有条目平铺，无 L0-L3 抽象层级） | Agent 上下文加载粒度过粗，无法按任务阶段选择加载层级 |
| G2 | 无自动提取管线 | 知识完全靠人工识别入库，容易遗漏 |
| G3 | 无全文/语义检索 | 90+ 条目后仅靠 YAML 索引发现能力不足 |
| G4 | 无量化度量 | 无法判断知识利用率、检索命中率 |
| G5 | 无与外部 agent 双向传递的能力 | 知识锁死在 MumuSpec 体系内，其他 agent 无法消费；agent 侧积累的知识也无法回流 |

---

## 3. 知识持久化改进（MumuSpec 侧）

### 3.1 语义金字塔（L0→L3）

| 层级 | 名称 | 内容特征 | 索引键 | 加载策略 |
|------|------|----------|--------|----------|
| **L0 Evidence** | 证据 | change artifacts 中的原始内容（决策 MD、任务执行记录） | `source_artifact` | Archive 时自动关联，按需溯源 |
| **L1 Atom** | 原子 | 单一可独立理解决策/模式/教训 | `id` (KP-xxxx) | 日常上下文，全部加载 |
| **L2 Scenario** | 场景 | 相关 L1 按业务域聚合（如"约束层设计"、"发布流水线"） | `scenario_id` | 任务规划阶段按需展开 |
| **L3 Summary** | 高层 | 跨域设计原则、用户偏好约束、项目禁止项 | `scope: global` + `type: summary` | 每次会话启动时优先加载 |

**实现方式**：不新增存储目录，通过 frontmatter 字段 `level: L0|L1|L2|L3` + `scenario` 分类 + `_index.yaml` 过滤实现。

### 3.2 自动提取管线

```
                   ┌─────────────────────┐
                   │  Archive 命令触发    │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  T1. 候选工件扫描    │
                   │  tasks.md           │
                   │  decisions.md       │
                   │  feedback/          │
                   │  test-cases/        │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  T2. L1 蒸馏 (dry-run)│
                   │  输出 diff 预览       │
                   │  不直接入库           │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  T3. 人工确认         │
                   │  编辑/删除/确认       │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  T4. 入库 + 重索引    │
                   │  更新 _index.yaml    │
                   │  更新 _reverse-index │
                   │  L2/L3 聚合检查      │
                   └─────────────────────┘
```

**关键约束**：必须 dry-run → 人工确认，绝不自动入库。知识是契约性资产，自动入库 = 自动修改项目约束 = 违反 SHALL NOT。

### 3.3 检索增强

新增命令 `mumuspec knowledge search`：

```
mumuspec knowledge search "ponytail 约束"
mumuspec knowledge search "安全加固" --type pattern,lesson
mumuspec knowledge search --graph src/core/types.ts  # 图谱感知：搜绑定到该文件的知识
mumuspec knowledge search --confirmed-only              # 仅搜已确认条目
```

**Phase 1**：FTS5（零依赖）
**Phase 2**：可选 sqlite-vec（opt-in）
**Phase 3**：RRF 混合融合

### 3.4 度量体系

```yaml
# _metrics.yaml
stats:
  total_queries: 0
  cache_hits: 0
  exports:           # 新增：导出统计
    claude: 0
    cursor: 0
    windsurf: 0
  imports:           # 新增：导入统计
    claude: 0
    cursor: 0
    conversation: 0
  by_type:
    decision: 0
    pattern: 0
    lesson: 0
    rationale: 0
    risk: 0
  unused_threshold_days: 30
```

新增 `mumuspec knowledge stats` 命令查看。

---

## 4. 双向知识传递架构

### 4.1 转移动词定义

| 方向 | 动词 | 含义 | 触发方式 |
|------|------|------|----------|
| MumuSpec → Agent | **export** | 将 MumuSpec 知识译为 agent 格式落盘 | 文件操作 |
| MumuSpec → Agent | **tell** | 通过对话让 agent 直接理解知识 | Skill 调用 |
| Agent → MumuSpec | **import** | 解析 agent 格式文件 → MumuSpec 知识条目 | 文件操作 |
| Agent → MumuSpec | **absorb** | 通过对话让 agent 主动报告知识，转换为条目 | Skill 调用 |

### 4.2 Agent 能力分级

根据 agent 是否暴露文件读写能力或对话接口，分为三级：

| 等级 | 代表 Agent | Export 方式 | Import 方式 |
|------|-----------|-------------|-------------|
| **L1 文件型** | Claude Code, Cursor, Windsurf, Continue, Cline, Copilot | Direct Export（生成规则/指令文件） | Direct Import（解析规则文件） |
| **L2 任务型** | Agent-Browser, Aider（CLI 强，上下文弱） | Direct Export（生成可粘贴规则片段） | Conversation Import（启动对话提取） |
| **L3 对话型** | 无文件系统的 Agent（API-only, LangChain Agent） | Skill Export（对话送达） | Conversation Import（对话提取） |

### 4.3 一次双向传递的完整流程

```
用户: "把 Cursor 规则里的学习经验同步到 MumuSpec，
       再把 MumuSpec 的安全约束更新给 Cursor"

    │
    ▼
Step 1: Import from Cursor
    │
    ├── mumuspec knowledge import --target cursor --scope project
    │       读取 .cursor/rules/ 下所有 .md
    │
    ├── Parse 提取约束/模式信息
    │
    ├── 与现有 MumuSpec 知识 diff
    │
    ├── dry-run 预览（显示新增/冲突/忽略）
    │
    └── 用户确认 → 入库为 imported scope 条目
    │
    ▼
Step 2: Export to Cursor
    │
    ├── mumuspec knowledge export --target cursor --scope global,type:risk
    │       筛选 MumuSpec 中 scope=global 且 type=risk 的条目
    │
    ├── 调用 CursorFormatter 转码
    │
    ├── 生成 .cursor/rules/mumuspec-security.md
    │
    └── 摘要报告：导出 N 条，覆盖 M 条
    │
    ▼
Step 3: 用户确认落盘 → 完成
```

---

## 5. Export 方向：推送 MumuSpec 知识至 Agent

### 5.1 Direct Export（直接文件生成）

| Target | 导出路径 | 知识映射 | 备注 |
|--------|----------|----------|------|
| `claude` | `.claude/skills/mumuspec-knowledge.md` | L3→MEMORY body, L1/L2→节选 | Claude 使用 skill-style MD |
| `cursor` | `.cursor/rules/mumuspec-*.md` | 按 type 拆分多个文件，L3 内容优先 | Cursor 支持多 rules 文件 |
| `windsurf` | `.windsurf/rules/mumuspec-*.md` | 与 cursor 结构接近 | 独立规则文件 |
| `continue` | `.continuerules` | 纯文本拼接，每条 knowledge 为 Markdown section | 单文件格式 |
| `cline` | `.clinerules` | 同 continue，文本格式 | 单文件格式 |
| `copilot` | `.github/copilot-instructions.md` | 全量 MD，L1-L3 + 所有条目 | Copilot 使用单一 instructions 文件 |
| `aider` | `.aider.rules.md` | rules 部分走 MD | 与 .aider.conf.yml 分离 |
| `output` | 用户指定目录/stdout | 原始 JSON/YAML 形式 | 通用出口 |

### 5.2 Skill Export（对话推送）

对于 **L2/L3 任务型 agent**（无文件系统或上下文有限），通过定制 skill 将知识"告知"agent：

```bash
# mumuspec knowledge tell --target <agent> --scope <scope>
mumuspec knowledge tell --target aider --scope global --type decision,pattern
```

**工作原理**：
1. MumuSpec CLI 加载目标 scope 的知识条目
2. 调用对应 agent skill 的对话接口（如 aider 的 `/run`、CatPaw 的 `/skill`）
3. 以结构化格式将知识**推送到 agent 上下文中**
4. agent 无需读取文件即可在后续对话中使用这些知识

**Skill 设计**：

```
skills/
└── mumuspec-knowledge-export/
    ├── SKILL.md              # Skill 描述与触发条件
    ├── prompts/
    │   ├── claude.md         # Claude 推送模板
    │   ├── cursor.md         # Cursor 推送模板
    │   └── generic.md        # 通用模板
    └── templates/
        ├── full.md           # 全量推送模板
        └── partial.md        # 增量推送模板
```

**Skill 对话流程**（以 Claude Code 为例）：

```
User: /mumuspec-knowledge-export --scope global

System: [Loading 12 knowledge entries from MumuSpec global scope]

System: [MumuSpec 项目知识推送 - 共 12 条]
================================================

【项目约束 L3】
1. Ponytail 7 级优先级：YAGNI → 复用 → 标准库 → 平台 → 依赖 → 单行 → 最小代码
2. 外部契约变更必须：影响分析 → 用户确认 → 文档同步 → 记录持久化
3. Top-Down Design, Bottom-Up Implementation
...

【关键决策 L1 - 节选】
- KP-0001: 双约束 + 树状分层 + 渐进式披露 + 动态强度
- KP-0004: Ponytail 编码约束（7 级优先级阶梯）
...

================================================
已将上述知识注入对话上下文。请在后续任务中遵守。
```

### 5.3 Export 命令语法

```bash
# 直接文件导出
mumuspec knowledge export --target claude

# 指定 scope / type / tags 过滤
mumuspec knowledge export --target cursor --scope global --type decision,pattern

# 对话式推送（适用于无文件系统的 agent）
mumuspec knowledge tell --target aider --scope global

# 推送指定条目
mumuspec knowledge tell --target claude --ids KP-0001,KP-0004

# 增量推送（仅推送上次导出后变更的条目）
mumuspec knowledge tell --target claude --since 2026-08-01

# 预览（不实际落盘或推送）
mumuspec knowledge export --target claude --dry-run
mumuspec knowledge tell --target claude --dry-run

# 列出所有支持的目标
mumuspec knowledge export --list-targets
mumuspec knowledge tell --list-targets
```

---

## 6. Import 方向：从 Agent 吸收知识进 MumuSpec

### 6.1 Direct Import（直接文件解析）

| Target | 导入来源 | 解析策略 | 后备方式 |
|--------|----------|----------|----------|
| `claude` | `CLAUDE.md`, `.claude/skills/*.md` | LLM 抽取结构化信息 | Conversation Import |
| `cursor` | `.cursor/rules/*.md` | 解析 Markdown 分段 | Conversation Import |
| `windsurf` | `.windsurf/rules/*.md` | 解析 Markdown 分段 | Conversation Import |
| `continue` | `.continuerules` | 文本分段 + 类型推断 | Conversation Import |
| `cline` | `.clinerules` | 文本分段 + 类型推断 | Conversation Import |
| `copilot` | `.github/copilot-instructions.md` | LLM 抽取结构化信息 | - |
| `aider` | `.aider.rules.md` | 文本分段 + 类型推断 | Conversation Import |

### 6.2 Conversation Import（对话提取）

对于 **L2/L3 agent**（无法直接读取文件，或文件结构极度不标准），启动一次**知识提取对话**：

```bash
# mumuspec knowledge absorb --target <agent>
mumuspec knowledge absorb --target claude --scope project
```

**工作原理**：
1. CLI 启动一个对话 session（或通过 MCP/API 调用目标 agent）
2. 发送"知识提取 prompt"，要求 agent 以结构化格式输出自身记忆
3. 解析返回的结构化文本 → 转换为 MumuSpec 知识条目
4. dry-run 预览 → 用户确认 → 入库

**知识提取 Prompt 模板**（以 Claude Code 为例）：

```
[System Prompt]

你是 MumuSpec 知识收集助手。请分析你当前项目中的 CLAUDE.md 
和 .claude/skills/ 下所有文件，提取其中的：

1. 项目约束 / 禁止项（SHALL / SHALL NOT / MUST）
2. 设计决策与原因
3. 代码模式与约定
4. 已知教训与风险

请以如下 JSON 格式输出：

{
  "entries": [
    {
      "type": "decision|pattern|lesson|rationale|risk",
      "title": "简短标题",
      "content": "详细描述",
      "confidence": "high|medium|low",
      "tags": ["tag1", "tag2"]
    }
  ]
}

只输出客观存在的知识，不要编造。当前无相关知识则返回空列表。
```

### 6.3 Import 命令语法

```bash
# 直接解析器导入
mumuspec knowledge import --target cursor

# 对话式提取（无文件访问能力的 agent）
mumuspec knowledge absorb --target claude

# 指定 scope / type
mumuspec knowledge import --target claude --type decision,pattern

# 仅导入已确认条目（跳过 draft）
mumuspec knowledge import --target claude --dry-run

# 合并策略（遇到相同 title 时的处理）
mumuspec knowledge import --target cursor --merge skip|overwrite|new-version
```

### 6.4 Import 冲突处理

```
┌────────────────────────────────────────────────────────┐
│               Import 冲突解决策略                        │
├──────────────┬─────────────────────────────────────────┤
│ skip         │ 目标条目已存在则跳过（默认）              │
│ overwrite    │ 用新内容替换已有条目（需用户确认）         │
│ new-version  │ 新增条目，标题加版本后缀 (v2)             │
│ merge        │ 内容合并（LLM 辅助合并两版本）            │
│ manual       │ 标记冲突，由用户逐条处理                  │
└──────────────┴─────────────────────────────────────────┘
```

### 6.5 安全与校验

导入的知识**必须经过校验**才能入库：

| 校验项 | 方式 | 失败处理 |
|--------|------|----------|
| 重复检测 | title 相似度 + content 哈希 | 提示冲突，按策略处理 |
| 类型推断 | LLM 分类（仅 6 种 type） | 标记 draft，用户审核 |
| 来源标记 | 强制 `source_agent` 字段 | 标记为 `imported` scope |
| 内容安全 | 不含恶意代码/敏感信息 | 标记高风险，用户审核 |

---

## 7. 插件架构（双向 Formatter）

```typescript
// src/core/sync/formatters/types.ts

/**
 * 双向知识传递插件
 * 每个 Target 一个实现，同时支持 export 和 import 两个方向
 */
interface KnowledgeSyncPlugin {
  target: string;                          // "claude" / "cursor" / ...
  capabilities: SyncCapabilities;          // 声明具备的能力
  
  // === Export 方向 ===
  formatForAgent(entries: KnowledgeEntry[], opts: ExportOptions): AgentArtifact;
  
  // === Import direction ===
  parseFromAgent(source: string, opts: ImportOptions): KnowledgeEntry[];
  
  // === 对话兜底（当 Direct 不可用时）===
  getExportPrompt?(entries: KnowledgeEntry[]): string;      // 生成对话推送 prompt
  getExtractPrompt?(): string;                               // 生成对话提取 prompt
  parseConversationResponse?(response: string): KnowledgeEntry[]; // 解析 agent 回复
}

interface SyncCapabilities {
  directExport: boolean;       // 能否直接生成文件
  directImport: boolean;       // 能否解析文件
  conversationFallback: boolean; // 是否支持对话兜底
  supportedTypes: KnowledgeType[]; // 支持的知识类型
}

// 注册表示例
const syncPlugins: Record<string, KnowledgeSyncPlugin> = {
  claude: new ClaudeSyncPlugin(),     // direct 双向 + 对话兜底
  cursor: new CursorSyncPlugin(),     // 仅 direct 双向
  windsurf: new WindsurfSyncPlugin(), // 仅 direct 双向
  continue: new ContinueSyncPlugin(), // 仅 direct 双向
  aider: new AiderSyncPlugin(),       // direct export + conversation import
  copilot: new CopilotSyncPlugin(),   // 仅 direct export（Copilot 不暴露文件读）
  generic: new GenericSyncPlugin(),   // 仅对话兜底（未知 agent 的通用方案）
};
```

### 7.1 `generic` 兜底插件

当目标 agent 不在预制列表中时，`generic` 插件提供：
- Export：生成纯文本知识块，通过对话 paste 到 agent
- Import：发送通用提取 prompt，尝试解析自由格式回复

这保证了**任何 agent 都能完成双向传递**，只是体验不如预制的 `direct` 模式。

---

## 8. 导出/导入格式示例

### 8.1 Export 至 Claude Code（Direct Export）

→ `.claude/skills/mumuspec-knowledge.md`

```markdown
# MumuSpec Project Knowledge (Auto-exported)

> Source: MumuSpec knowledge/ | Exported: 2026-08-08T16:52:16Z

## Project Constraints (L3 Summary)

- **Ponytail 7-Level Priority**: SHALL reuse existing code; SHALL NOT introduce unrequested abstractions
- **Contract Changes**: MUST go through impact analysis + user confirmation before modification
- **Top-Down Design, Bottom-Up Implementation**: Design root→leaves, implement leaves→root
- **Red-Green TDD**: Test cases are design output, locked after Design phase

## Key Decisions (L1 Atoms)

### KP-0001: Dual Constraint Tree Progressive
MumuSpec uses four core design pillars: dual constraint (SHALL + SHALL NOT)...

## Patterns

### KP-0012: Spec Progressive Loading
Knowledge is loaded progressively by scope and freshness...
```

### 8.2 Export 至 Cursor（Direct Export）

→ `.cursor/rules/mumuspec-constraints.md`

```markdown
# Auto-exported from MumuSpec knowledge/
# Exported: 2026-08-08

Must Follow:
- Ponytail 7-level priority: reuse existing code first, YAGNI
- SHALL NOT introduce unrequested abstractions
- Top-down design, bottom-up implementation
- External contract changes require user confirmation

Patterns:
- Progressive disclosure: load specs by tree depth
- Code-bound: constraints in .mumuspec/, versioned
```

### 8.3 Import from Claude Code（Direct Import + LLM 解析）

**分析**：CLAUDE.md 通常为自由格式 .md，无严格 schema

**解析流程**：
1. 读取 CLAUDE.md 全文
2. 按二级/三级标题分段
3. 对每段内容调用 LLM 分类（type + tags + confidence）
4. 生成 MumuSpec 知识条目（scope: imported, source_agent: claude）
5. dry-run 预览

### 8.4 Import via Conversation（对话提取全过程示例）

```bash
$ mumuspec knowledge absorb --target claude --dry-run

[1/3] 读取 CLAUDE.md (2,340 bytes)
       检测到 8 个候选知识片段

[2/3] LLM 分类中...
       - "Requirement analysis MUST use 5-step process"     → decision (high)
       - "All biases must be documented"                    → pattern (medium)
       - "Failed approach: over-engineering constraints"    → lesson (high)
       - ...

[3/3] Dry-run 预览 (新增 5 / 冲突 2 / 跳过 1)
       + KP-NEW-001  [decision] Requirement analysis...    (imported/claude)
       + KP-NEW-002  [pattern]  All biases documented...   (imported/claude)
       ! KP-0042     [lesson]  Over-engineering...         (冲突: 内容 87% 重复)
       ...

确认导入？[y/N/e(dit)]
```

### 8.5 Skill-based Export（对话推送全过程示例）

```bash
$ mumuspec knowledge tell --target aider --scope global --dry-run

[Knowledge Export - Aider Target]
================================================

将推送 8 条 knowledge 至 Aider：

【L3 Summary】2 条
  - Ponytail 7-level priority ladder
  - External contract change protocol

【L1 Decision】4 条
  - KP-0001: Dual constraint tree progressive
  - KP-0004: Ponytail coding constraints
  - KP-0006: Knowledge layer design
  - KP-0009: MVP scope definition

【L1 Pattern】2 条
  - KP-0014: Change lifecycle
  - KP-0015: Spec enforcement pattern

推送方式: 对话注入（/tmp/mumuspec-prompt.md → 自动 paste）

确认推送？[y/N]
```

---

## 9. 实施路线

### Phase 1 — 语义金字塔 + 检索（2 周）

| 任务 | 产出 |
|------|------|
| frontmatter 新增 `level`, `scenario`, `source_agent` 字段 | schema v2 |
| 实现 `mumuspec knowledge search`（FTS5） | 新 CLI 命令 |
| Archive dry-run → L1 蒸馏预览 | skill 步骤更新 |
| `_metrics.yaml` 读写 + `mumuspec knowledge stats` | 新 CLI 命令 |

### Phase 2 — 导出命令（1 周）

| 任务 | 产出 |
|------|------|
| `KnowledgeSyncPlugin` 接口 + 注册表 | 新核心模块 |
| 实现 claude/cursor/direct 双向插件 | 导出核心 |
| `mumuspec knowledge export` + `tell` 命令 | 2 个新 CLI 命令 |

### Phase 3 — 导入命令（1 周）

| 任务 | 产出 |
|------|------|
| Direct Import 解析器 | import 方向核心 |
| Absorb（对话提取）引擎 | conversation 方向核心 |
| `mumuspec knowledge import` + `absorb` 命令 | 2 个新 CLI 命令 |
| `generic` 兜底插件 | 未知 agent 兼容 |

### Phase 4 — 量化 + 治理（1 周）

| 任务 | 产出 |
|------|------|
| 度量埋点（检索命中、导出/导入频次） | _metrics.yaml 完善 |
| `mumuspec knowledge prune`（未利用条目标记） | 新 CLI 命令 |
| L2/L3 自动聚合 | 可选核心模块 |
| 冲突处理策略 UI | 交互式选择器 |

---

## 10. 约束与风险

### 硬性约束（SHALL NOT）

- 知识自动提取结果绝不能未经人工确认直接入库（无论来自 change artifacts 还是外部 agent）
- 双向传递不做自动触发，每次 export/import 必须用户显式调用
- 不引入 Phase 1 外部依赖（FTS5 在 SQLite 内置）
- 导入的知识不能自动标记为 `confirmed`，必须经人工审核
- 不与外部 agent 保持长连接或实时同步

### 风险表

| 风险 | 影响 | 缓解 |
|------|------|------|
| Schema 升级破坏现有条目 | 条目无法被索引 | 自动 migration 脚本 + 保留旧字段兼容 |
| 外部 agent 知识与 MumuSpec 知识冲突 | 决策矛盾 | 冲突标记 + 用户选择 + source_agent 溯源 |
| Import 内容质量参差 | 知识库噪声 | 置信度评分 + draft 标记 + 人工审核 |
| LLM 解析 agent 格式出错 | 导入数据不准确 | dry-run 预览 + 人工确认 + generic fallback |
| 对话提取 Prompt 被 agent 忽略 | 知识无法回流 | 多轮重试 + 简化 prompt + manual fallback |
| 双向传递产生循环覆盖 | 数据震荡 | 单向操作不自动触发反向 + source_agent 标记阻断循环 |
| Formatter 随 agent 版本迭代失效 | 解析失败 | CI 检测 + formatter 独立测试 |

---

## 11. 参考

- TencentDB Agent Memory: https://github.com/TencentCloud/TencentDB-Agent-Memory
- Claude Code memory: https://docs.anthropic.com/en/docs/claude-code/memory
- Cursor Rules: https://docs.cursor.com/context/rules
- Continue: https://docs.continue.dev/customization/overview
- Copilot instructions: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions
- Aider: https://aider.chat/docs/usage/conventions.html
