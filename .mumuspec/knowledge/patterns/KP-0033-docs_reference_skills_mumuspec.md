---
id: "KP-0057"
title: "MumuSpec — 规范驱动的 AI 编程工作流主编排器"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/skills/mumuspec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# MumuSpec — 规范驱动的 AI 编程工作流主编排器

> **Source**: `docs/reference/skills/mumuspec.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

MumuSpec 以树状双向约束规范（WHAT）为核心，外部 Skill 生态负责 HOW，Guard Layer 兜底校验。

## Original Content

---
name: mumuspec
description: "MumuSpec — 规范驱动的 AI 编程工作流。以 /mumuspec 启动，自动检测阶段并分发到子命令。五阶段：open → design → build → verify → archive。"
phase: orchestrator
workflow: "*"
---

# MumuSpec — 规范驱动的 AI 编程工作流主编排器

MumuSpec 以树状双向约束规范（WHAT）为核心，外部 Skill 生态负责 HOW，Guard Layer 兜底校验。

```
MumuSpec 管 WHAT  — SHALL/SHALL NOT 约束、规范生命周期、知识管理
外部 Skill 管 HOW — 技术设计、实现方法、验证策略
Guard Layer 兜底  — 外部 Skill 产出必须通过约束校验
```

**核心原则：brainstorming 不可跳过。每个变更必须经过深度设计（hotfix/tweak 预设除外）。**

---

## 快速决策（Decision Core）

Agent 只需读取本节即可决策。详细参考后续章节。

### 阻塞点清单

| 阻塞点 | 阶段 | 说明 |
|--------|------|------|
| BP-1/2/3 | Open | 需求澄清确认、PRD 拆分、工件审查 |
| BP-4~8 | Design | 设计方案、认知框架 Q2/Q3、Hyperplan 问题、测试锁定 |
| BP-9~13 | Build | 计划暂停、执行方式、分支命名、规范增量、范围扩展 |
| BP-14~16 | Verify | 验证失败、Spec 漂移、分支处理 |
| BP-17 | Archive | 归档最终确认 |
| BP-18 | 预设路径 | 升级条件触发 |

### 自动阶段检测流程

```
Step 0: 预设检测（最高优先级）
  ├── 用户描述 Bug 修复 + 满足 hotfix 条件 → 调用 /mumuspec-hotfix
  ├── 用户描述文案/配置/文档微调 + 满足 tweak 条件 → 调用 /mumuspec-tweak
  └── 无预设匹配 → 进入 Step 1

Step 1: 活跃变更发现
  └── 运行 mumuspec status --json 获取活跃变更列表

Step 2: 读取 .mumuspec.yaml 状态
  └── 读取 phase + workflow 字段确定当前阶段

Step 3: 阶段判定（按序检查，首个匹配生效）
  1. archived == true → 工作流完成
  2. verify_result == pass && archived != true → 调用 /mumuspec-archive
  3. verify_result == fail → 验证失败阻塞点（等待用户选择修复/接受偏差）
  4. phase == verify || tasks 全部完成 → 调用 /mumuspec-verify
  5. phase == build || 有 design.md 但 plan/执行不完整 → 按 workflow 路由
  6. phase == design || 有变更但无 design.md → 调用 /mumuspec-design
  7. phase == open || 有活跃变更但 .mumuspec.yaml 缺失 → 调用 /mumuspec-open
  8. 无活跃变更 → 调用 /mumuspec-open
```

---

## 1. 输出语言规则

使用触发本工作流的用户请求的语言作为默认输出语言。恢复已有变更时，若工件已有明确的主导语言，保持该语言不变，除非用户明确要求切换。

---

## 2. 预设检测

**预设检测具有最高优先级**：

- 用户明确描述 Bug 修复/hotfix + 满足 hotfix 条件 → 直接调用 `/mumuspec-hotfix`
- 用户明确描述文案/配置/文档/提示词微调 + 满足 tweak 条件 → 直接调用 `/mumuspec-tweak`
- 无预设匹配 → 按下表处理

| 活跃变更数 | 用户输入 | 行为 |
|-----------|---------|------|
| 无 | 非预设输入 | → 调用 `/mumuspec-open` |
| 1 个 | `/mumuspec <描述>` | → 询问：继续此变更或创建新变更 |
| 多个 | `/mumuspec <描述>` | → 询问：继续已有或创建新的；若继续则列出变更供选择 |
| 1 个 | `/mumuspec` 无描述 | → 自动选择，进入阶段检测 |
| 多个 | `/mumuspec` 无描述 | → 列出变更供用户选择 |

<IMPORTANT>
当用户选择"创建新变更"时，**必须调用 `/mumuspec-open`**。`/mumuspec-open` 执行双重初始化：创建变更工件 + 初始化 `.mumuspec.yaml` 状态文件。
</IMPORTANT>

---

## 3. 恢复规则

- 每次上下文恢复时，重新执行 Step 0-3，不依赖会话历史进行阶段检测
- 若有活跃变更且 worktree 有未提交更改，通过 dirty-worktree 协议处理
- 若 `phase: build`，先检查 `build_pause`、`build_mode`、`isolation`：
  - `build_pause: plan-ready` 且 `isolation` 和 `build_mode` 已设置 → 过期暂停，自动清除并继续
  - `build_pause: plan-ready` 且 plan 文件存在但 `isolation`/`build_mode` 未设置 → 返回 `/mumuspec-build` plan-ready 恢复点
  - `build_pause: plan-ready` 但 plan 文件缺失 → 返回 `/mumuspec-build` 处理
  - `build_mode`/`isolation`/`tdd_mode` 未设置 → 返回 `/mumuspec-build` 补充
  - 全部已设置 → 读取下一个未完成任务继续执行
- 若 `phase: verify` 且 `verify_result: fail` → 验证失败阻塞点
- 若 `phase: open` 但 proposal/design/tasks 已完成 → 先运行 guard `--apply` 修复状态

---

## 4. 预设升级条件

### hotfix → full（满足任一即升级）

| 条件 | 说明 |
|------|------|
| 变更涉及 3+ 文件 | 超出单点修复范围 |
| 架构变更 | 新模块、新接口、新依赖 |
| 数据库 schema 变更 | 结构调整 |
| 引入新公共 API | 修复创建新外部接口 |
| 修复范围超出单个函数/模块 | 需协调变更 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

### tweak → full（满足任一即升级）

| 条件 | 说明 |
|------|------|
| 变更涉及 5+ 文件 | 超出小变更范围 |
| 跨模块协调 | 需跨组件协调 |
| 5+ 新测试用例 | 变更复杂度上升 |
| 配置项增删（非值修改） | 超出值调整范围 |
| 新增能力需求 | 超出局部优化 |
| 需要 delta spec | 影响既有规范 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

---

## 5. 阶段流转

<IMPORTANT>
单次 `/mumuspec` 调用从检测到的阶段开始，在退出条件满足时自动推进到下一阶段。

**连续执行要求**：从检测到的阶段开始，Agent 自动继续后续所有阶段。但**自动推进仅在无用户决策的转换点生效**。遇到用户决策点时，**必须使用当前平台可用的用户输入/确认机制暂停并等待用户显式响应**。不得用推荐规则、默认值或历史偏好替代用户确认。

**阶段推进 vs 自动交接**：每个子 Skill 运行 Phase Guard `--apply` 推进 `.mumuspec.yaml` 的 `phase` 字段。此步骤**始终执行**。之后运行 `mumuspec state next <name>` 决定是否自动调用下一 Skill。
</IMPORTANT>

### 决策点为阻塞点

遇到以下任一节点时，当前 `/mumuspec` 调用必须停止，**使用当前平台可用的用户输入/确认机制等待用户选择**：

1. Open 阶段提案/设计/任务审查确认 (BP-3)
2. Brainstorming 中确认设计方向 (BP-4)
3. Build 阶段 plan-ready 暂停选择 + 工作流配置选择 (BP-9, BP-10)
4. Verify 失败时修复或接受偏差 (BP-14)
5. 分支处理方式选择 (BP-16)
6. Archive 阶段归档最终确认 (BP-17)
7. 遇到升级条件 (BP-18)
8. Build 阶段范围扩展需重新设计或拆分新变更 (BP-13)
9. Open 阶段大型 PRD 需确认拆分 (BP-2)

### Red Flags — 出现以下想法时，STOP 并检查

| Agent 想法 | 实际风险 |
|-----------|---------|
| "用户可能同意这个方案" | 不能替用户决策 — 使用用户输入/确认机制 |
| "这是小变更，不需要确认" | 决策点无大小例外 — 阻塞点必须等待 |
| "用户上次选了 A，这次也选 A" | 历史偏好不能替代当前确认 |
| "我解释了计划，用户没反对" | 不反对 ≠ 同意 — 必须获取显式选择 |
| "流程到了这里，应该没问题" | 验证未通过 ≠ 通过 — 检查 verify_result |

---

## 6. 子命令快速参考

| 命令 | 阶段 | 管理方 | 核心工件 |
|------|------|--------|---------|
| `/mumuspec-open` | 1. Open | MumuSpec | proposal.md, delta-specs/, cognitive-map.yaml(预热) |
| `/mumuspec-design` | 2. Design | MumuSpec + 外部 Skill | design.md, cognitive-map.yaml, test-cases/, constraints/ |
| `/mumuspec-build` | 3. Build | 外部 Skill | tasks.md, suite-map.yaml, 代码提交 |
| `/mumuspec-verify` | 4. Verify | MumuSpec + 外部 Skill | verify.md, 分支处理 |
| `/mumuspec-archive` | 5. Archive | MumuSpec | 主规范合并, 知识提取, 归档记录 |
| `/mumuspec-hotfix` | 预设 | 两者 | 快速修复（跳过 Design） |
| `/mumuspec-tweak` | 预设 | 两者 | 小变更（跳过 Design 和完整 Verify） |

```
/mumuspec
  ↓ 自动检测
/mumuspec-open ──→ /mumuspec-design ──→ /mumuspec-build ──→ /mumuspec-verify ──→ /mumuspec-archive

/mumuspec-hotfix (预设，跳过 Design)
  open ──→ build ──→ verify ──→ archive
    ↑ 升级触发 → 阻塞确认 → 补充 Design → 回到 full 工作流

/mumuspec-tweak (预设，跳过 Design 和完整 Verify)
  open ──→ lightweight build ──→ light verify ──→ archive
    ↑ 升级触发 → 阻塞确认 → 补充 Design → 回到 full 工作流
```

---

## 7. 错误处理快速参考

| 场景 | 处理方式 |
|------|---------|
| `mumuspec status --json` 失败 | 检查 mumuspec 是否安装，提示运行 `mumuspec init` |
| 子 Skill 不可用 | 停止工作流，提示安装或启用对应 Skill |
| `.mumuspec.yaml` 损坏或缺失 | 以文件状态为事实来源，使用 `mumuspec state set` 修正后继续 |
| 构建/测试失败 | 回到 build 阶段修复，不进入 verify |
| 变更目录结构不完整 | 按 `/mumuspec-open` 工件要求补全缺失文件 |

---

## 8. .mumuspec.yaml 字段参考

```yaml
workflow: full                   # full|hotfix|tweak
phase: build                     # open|design|build|verify|archive
design_doc: design.md
cognitive_map: cognitive-map.yaml
plan: tasks.md
base_ref: a1b2c3d4e5f6
build_mode: null                 # executing-plans|subagent-driven-development|direct
build_pause: null                # null|plan-ready
isolation: null                  # branch|worktree
tdd_mode: tdd                    # 固定为 tdd
verify_mode: null                # light|full
verify_result: pending           # pending|pass|pass-with-deviations|fail
verification_report: null
branch_status: pending           # pending|handled
archived: false
created_at: 2026-07-10
verified_at: null

# MumuSpec 独有字段
affected_scopes: []
build_layers: []
test_cases:
  design_locked: false
  design_content_hash: null
  suites_locked: false
cognitive_framework:
  enabled: false
  converged: false
  rounds_completed: 0
rollback_count: 0
rollback_limit: 3
rebuild_count: 0
rebuild_limit: 5
```

### 状态机硬约束

- `build → verify` 前，`isolation` 必须为 `branch` 或 `worktree`
- `build → verify` 前，`build_mode` 必须已选择
- `build_mode: subagent-driven-development` 必须有 `subagent_dispatch: confirmed`
- full 工作流离开 build 阶段前，`tdd_mode` 必须为 `tdd`
- `build_mode: direct` 仅 hotfix/tweet 可用；full 需 `direct_override: true`
- `build_pause` 不是执行方法，不可写入 `build_mode`
- full 工作流 `design → build` 前，认知框架必须收敛
- hotfix/tweak 跳过 Design，不执行认知框架

