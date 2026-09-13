---
name: phase-open
description: "MumuSpec Phase 1: Open。以 /phase-open 启动。探索需求、创建变更工件、影响分析、知识加载、worktree 隔离。"
---

# Phase: Open — 提案与需求探索

> **阶段**: 1 · **workflow**: full

## 快速决策（Decision Core）

**前置条件**：无活跃变更，或用户想创建新变更

**阻塞点**：
- BP-1: 需求澄清完成确认
- BP-2: PRD 拆分决策
- BP-3: 工件审查与确认

**退出条件**：proposal.md + delta-specs/ + 影响分析 + worktree + .mumuspec.yaml 创建完成，用户已确认，Phase Guard 通过

---

## 前置条件

- 无活跃变更，或用户想创建新变更
- MumuSpec 已初始化（`.mumuspec/` 存在）

---

## Required Skill 降级策略

当 required skill 不可用时，执行以下 inline fallback。**降级时必须记录到 decisions.md Open 章节**。

| Skill | 不可用时的替代方案 |
|-------|------------------|
| `brainstorming` | 使用平台内置 AskQuestion 工具，按"目标→非目标→范围边界→关键未知→验收场景"结构进行多轮 Q&A（见 Fallback A） |
| `gitnexus-impact-analysis` | 使用 `grep`/`find` + 代码阅读手动分析影响范围（见 Fallback B） |
| `using-git-worktrees` | 降级为 branch 模式或直接使用当前工作区，记录降级原因（见 Fallback C） |
| `spec-driven-development` | 使用 delta-specs/ 标准模板手动编写（见 Fallback D） |

### Fallback A：brainstorming 替代流程

```
Round 1: 使用 AskQuestion 探索目标、非目标、范围边界
Round 2: 使用 AskQuestion 探索关键未知、风险依赖
Round 3: 使用 AskQuestion 确认草拟验收场景
每轮提问至少 2 个问题，用户确认后进入下一轮
至少执行 2 轮 Q&A 才可进入 Step 1b 确认
```

### Fallback B：gitnexus-impact-analysis 替代流程

```bash
# 1. 确认当前 HEAD
BASE_REF=$(git rev-parse HEAD)
echo "$BASE_REF" > .mumuspec/changes/<name>/code-graph/base-ref.txt

# 2. 分析受影响文件（手动方式）
#    - 读取 proposal.md 中的 affected_scopes
#    - 使用 grep -r 搜索相关 import/require 引用
#    - 读取相关源文件理解调用链
#    - 创建 impact-analysis.json（按标准格式）

# 3. 搜索受影响函数
grep -rn "functionName" src/ --include="*.ts" --include="*.js"
```

### Fallback C：using-git-worktrees 替代流程

```bash
# 尝试创建 worktree
if git worktree add .worktrees/<name> -b "mumuspec/<name>" 2>/dev/null; then
  echo "Worktree created successfully"
else
  # 降级：记录原因到 decisions.md
  echo "降级为当前工作区模式（原因：worktree 创建失败）"
  # 继续使用当前工作区，不阻断流程
fi
```

### Fallback D：spec-driven-development 替代流程

直接按以下结构创建 delta-specs/：
```markdown
---
id: DS-XXX-001
layer: 0
scope: <scope>
delta: ADDED|MODIFIED|REMOVED
---

## Requirement: <需求名称>

### SHALL
- SHALL <要求描述>

### SHALL NOT
- SHALL NOT <禁止描述>
```

---

## 执行步骤

### Step 0: 输出语言约束

每个传递给用户的提示和工件请求必须包含输出语言约束：使用触发本工作流的用户请求的语言。 **幂等性**：可安全重复执行。

### Step 1: 需求探索与澄清

**立即执行**：使用 Skill 工具加载 `brainstorming` skill。

> **降级说明**：若 `brainstorming` skill 不可用，按上方 **Fallback A** 使用 AskQuestion 工具手动执行需求探索。**必须记录降级到 decisions.md**。

加载 skill 后，按照其指导探索问题空间，但不可将一轮 Q&A 视为充分澄清。必须持续提问、与用户对齐，形成涵盖以下内容的澄清总结：
- **目标**：用户真正想解决的问题和预期结果
- **非目标**：明确不在本变更范围内的内容
- **范围边界**：包含/排除的模块、用户、平台或数据
- **关键未知**：未解决的假设、风险或依赖
- **草拟验收场景**：至少核心成功场景和重要边界场景

### Step 1a: PRD 拆分预检 — BLOCKING POINT (BP-2)

当用户输入是大型 PRD、路线图、完整产品计划，或澄清总结显示多个独立能力时，必须在创建工件前评估是否拆分为多个变更。

**推荐拆分条件**（满足任一即推荐）：
- PRD 包含可独立设计/构建/验证/归档的多个能力
- 涉及多个模块或用户旅程，部分可独立交付
- 存在清晰的阶段里程碑
- 预期产出多个 delta spec 或超过 3 个大型任务

**用户选项**（必须使用平台用户输入/确认机制暂停等待）：
- "创建多个变更" — 按提议拆分列表创建独立变更
- "保持为单个变更" — 继续单变更流程，记录不拆分理由
- "调整拆分计划" — 用户描述调整后输出修订的拆分列表，再次确认

### Step 1b: 需求澄清完成确认 — BLOCKING POINT (BP-1)

创建工件前，**必须使用平台用户输入/确认机制暂停等待用户确认需求澄清已完成**。

暂停时展示澄清总结：目标、非目标、范围边界、关键未知、草拟验收场景。

**选项**：
- "确认，继续创建工件" — 基于澄清总结创建变更工件
- "需要调整" — 包含调整说明，修改后重新请求确认

### Step 2: 创建变更工件 + 初始化状态

1. 运行 `mumuspec new change "<name>"` 创建变更骨架
2. 基于 Step 1b 确认的澄清总结填写 `proposal.md`
3. 创建 `delta-specs/`（含 ADDED/MODIFIED/REMOVED 语义标记）
4. 创建 `constraints/new-shall.md` 和 `constraints/new-shall-not.md`

**命名守卫**：变更名必须使用用户指定名或通过用户输入/确认机制确认的名称 — 不可自动生成或推断。变更范围必须匹配用户描述 — 不可自行扩大或缩小。

确认以下工件已创建：

```
.mumuspec/changes/<name>/
├── .mumuspec.yaml              # 变更状态
├── proposal.md                 # 为什么 + 做什么 + 影响范围
├── delta-specs/                # 规范变更草案
├── constraints/
│   ├── new-shall.md            # 新增正向要求
│   └── new-shall-not.md        # 新增反向禁止
├── code-graph/
│   └── base-ref.txt            # 基线 commit SHA
└── decisions.md                # 决策记录
```

初始化 `.mumuspec.yaml`：
```bash
mumuspec state init <name> full
```

**幂等性**：若 `.mumuspec.yaml` 已为 `phase: open` 且所有工件文件存在，跳过已完成步骤，从第一个缺失步骤继续。

### Step 3: 代码图谱影响分析

**立即执行**：使用 Skill 工具加载 `gitnexus-impact-analysis` skill。

> **降级说明**：若 `gitnexus-impact-analysis` skill 不可用，按上方 **Fallback B** 手动执行影响分析。**必须记录降级到 decisions.md**。

加载后执行影响分析，结果记录到 `code-graph/impact-analysis.json`：
- 受影响文件列表
- 受影响函数/类列表
- 调用链影响范围
- 破坏性变更标记

**幂等性**：若 `impact-analysis.json` 已存在且 `base-ref.txt` 匹配当前 HEAD，跳过。

### Step 4: 加载历史知识 — MumuSpec 独有

从 Knowledge Layer PageIndex 加载 `affected_scopes` 的历史设计知识：

```bash
mumuspec knowledge context <scope-path> --scopes <affected_scopes>
```

**加载内容**：
- 与 affected_scopes 相关的 `type: rationale` 知识页面（设计理据）
- 与 affected_scopes 相关的 `type: decision` 知识页面（历史决策）
- 与 affected_scopes 相关的 `type: risk` 知识页面（已知风险）
- 知识新鲜度检查：标记 `stale` 或 `unverified` 的知识页面

### Step 5: 加载契约约束 — MumuSpec 独有

加载 affected_scopes 相关的外部契约和对外契约：

```bash
mumuspec contract list --scopes
mumuspec contract compat-check --change <name>
```

检查 delta-specs 的 REMOVED 操作是否破坏下游契约兼容性。

### Step 6: 创建 worktree 隔离

**立即执行**：使用 Skill 工具加载 `using-git-worktrees` skill。

> **降级说明**：若 `using-git-worktrees` skill 不可用或 worktree 创建失败，按上方 **Fallback C** 降级为当前工作区模式。**必须记录降级原因到 decisions.md**。

> **降级处理**：若 worktree 创建失败（磁盘空间/权限/git 异常），降级为 branch 模式：
> - 记录降级原因到 `decisions.md` Open 章节
> - 设置 `config: changes.default_isolation = branch`
> - 继续变更流程
> - 若用户拒绝降级 → 阻断变更创建

### Step 7: 追加 decisions.md Open 章节

通过 CLI 追加（**禁止手工编辑**——手工编辑会破坏 content_hash 审计链，guard 将报 E-CHANGE-007）：

```bash
mumuspec decisions append --phase open --change <name> --text "<决策摘要：拆分判定/scope 理由/workflow 选择/降级记录/知识加载摘要>"
```

记录要点（组织进 --text 或多条追加）：
- 是否拆分变更的决策
- `affected_scopes` 判定理由
- `workflow` 选择（full）
- worktree 降级记录（若有）
- 知识加载摘要

### Step 8: 内容完整性检查

确认工件内容完整：
- **proposal.md**：问题背景、目标、范围、非目标、影响范围
- **delta-specs/**：至少一个 spec 文件，含 SHALL 和 SHALL NOT
- **constraints/**：new-shall.md 和 new-shall-not.md 存在
- **impact-analysis.json**：存在且非空
- **decisions.md**：Open 章节至少 1 条决策

### Step 9: 用户审查与确认 — BLOCKING POINT (BP-3)

工件创建完成且内容完整性检查通过后，**必须使用平台用户输入/确认机制暂停等待用户确认**。

展示摘要：
- proposal.md：问题背景、目标、范围
- delta-specs/：变更的 SHALL/SHALL NOT 条目
- 影响分析：受影响文件数、调用链影响
- 知识加载：相关历史知识页面数
- 契约检查：兼容性结果

**选项**：
- "确认，进入下一阶段" — 工件符合预期，执行 Phase Guard 转换
- "需要调整" — 包含调整说明，修改后重新请求确认

---

## 退出条件

过程要求（agent 自律，非守卫检查项）：

- proposal.md, delta-specs/, constraints/ 全部创建且内容完整
- `code-graph/impact-analysis.json` 存在且非空（供影响分析用，守卫不校验）
- `affected_scopes` 定义在 `.mumuspec.yaml`
- 需求探索与历史知识加载已在过程中执行（记录于 decisions.md）
- **用户已确认** (BP-3)

守卫真正校验的出口条件（`open_to_design`）：

- proposal.md 存在且非空（`E-GUARD-001`）
- decisions.md content_hash 匹配（`E-CHANGE-007`）
- delta-specs/ 存在、affected_scopes 非空、`decisions_log.counts.open > 0`（`W` 级）
- **Phase Guard**：`mumuspec guard <name> design --apply`；全部 PASS 后自动转换

---

## Phase Guard 调用

```bash
mumuspec guard <change-name> design --apply
```

> **参数语义（此前文档写错，2026-09-12 修正）**：`guard <change> <phase>` 的 `<phase>` 是**目标**阶段，
> 不是当前阶段。离开 Open 意味着目标是 `design`。此前本文档写成 `guard <name> open`，
> 实际会被判为未知目标阶段（`E-CHANGE-006`）。
>
> 检查项清单以 [docs/reference/phase-guards.md#open_to_design](../../docs/reference/phase-guards.md)
为唯一权威源——本 skill 不再重复列举，避免“文档有、代码无”的第三态。

必须使用 `--apply`，否则 `.mumuspec.yaml` 保持 `phase: open`。

---

## 自动流转到下一阶段

Guard 推进后运行：
```bash
mumuspec state next <change-name>
```

- `NEXT: auto` → 调用 `phase-design`（full 工作流）
- `NEXT: manual` → 提示用户手动运行 `phase-design`

---

## 上下文压缩恢复

Open 阶段可能触发上下文压缩。恢复时运行：
```bash
mumuspec state check <change-name> --recover
```

脚本输出结构化恢复上下文（阶段、已完成字段、待完成字段、恢复动作）。按恢复动作决定下一步。

若 `phase: open` 且 proposal/delta-specs/已存在，检查内容完整性后直接进入 Step 9（用户确认）。

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "需求很清楚，不需要 brainstorming" | brainstorming 不可跳过 — 必须加载 skill |
| "一轮 Q&A 足够了" | 不可将一轮 Q&A 视为充分澄清 |
| "影响范围很小，跳过图谱分析" | 影响分析是 Phase Guard 必检项 |
| "历史知识不重要" | 知识加载是过程要求（agent 自律），守卫不校验该字段；跳过会失去历史决策与风险依据 |
| "用户没反对，直接创建工件" | 不反对 ≠ 同意 — BP-1 必须显式确认 |
| "变更名我来定" | 命名必须用户确认 — 不可自动生成 |
| "delta-specs 只要 SHALL 就行" | delta-specs 必须含 SHALL 和 SHALL NOT |
| "worktree 失败了直接用 branch" | 必须先记录降级到 decisions.md |

---

## 领域 Skill 提示（伴随能力）

> 伴随能力（companion，包外增强）：可用则用，不可用不阻断流程；**包内自足的必须步骤**是本文编号步骤本身。可用性由 `mumuspec skill companions` 统一枚举。

| 场景 | 伴随能力 | companion |
|------|-----------|----------|
| 需求探索 | `brainstorming` | 是 |
| 需求不明确 | `interview-me` | 可选 |
| 代码影响分析 | `gitnexus-impact-analysis` | 是 |
| 代码结构理解 | `gitnexus-exploring` | 可选 |
| 工作区隔离 | `using-git-worktrees` | 是 |
| 规范草案 | `spec-driven-development` | 是 |
