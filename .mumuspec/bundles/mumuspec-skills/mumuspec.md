---
name: mumuspec
description: "MumuSpec — 规范驱动的 AI 编程工作流。以 /mumuspec 启动，自动检测阶段并分发到子命令。五阶段：open → design → build → verify → archive。"
metadata:
  short-description: "MumuSpec 一站式工作流编排器（grill me 风格）"
  phase: orchestrator
  workflow: "*"
---

# MumuSpec 工作流编排器

> **grill me 风格入口**：一个命令感知全状态，一键驱动全生命周期。

MumuSpec 以树状双向约束规范（WHAT）为核心，外部 Skill 生态负责 HOW，Guard Layer 兜底校验。

```
MumuSpec 管 WHAT  — SHALL/SHALL NOT 约束、规范生命周期、知识管理
外部 Skill 管 HOW  — 技术设计、实现方法、验证策略
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
  ├── 用户描述 Bug 修复 + 满足 hotfix 条件 → 分发: workflow-presets (hotfix)
  ├── 用户描述文案/配置/文档微调 + 满足 tweak 条件 → 分发: workflow-presets (tweak)
  └── 无预设匹配 → 进入 Step 1

Step 1: 活跃变更发现
  └──  mumuspec list  获取活跃变更列表

Step 2: 读取状态
  └──  mumuspec status <name>  获取 phase + workflow

Step 3: 阶段判定（按序检查，首个匹配生效）
  1. archived == true → 工作流完成
  2. verify_result == pass && archived != true → 分发: phase-archive
  3. verify_result == fail → 验证失败阻塞点（等待用户选择修复/接受偏差）
  4. phase == verify || tasks 全部完成 → 分发: phase-verify
  5. phase == build || 有 design.md 但 plan/执行不完整 → 分发: phase-build
  6. phase == design || 有变更但无 design.md → 分发: phase-design
  7. phase == open || 有活跃变更但状态缺失 → 分发: phase-open
  8. 无活跃变更 → 分发: phase-open
```

---

## 输出语言规则

使用触发本工作流的用户请求的语言作为默认输出语言。恢复已有变更时，若工件已有明确的主导语言，保持该语言不变，除非用户明确要求切换。

---

## 预设检测（最高优先级）

- 用户明确描述 Bug 修复/hotfix + 满足 hotfix 条件 → 直接分发 `workflow-presets` (hotfix)
- 用户明确描述文案/配置/文档/提示词微调 + 满足 tweak 条件 → 直接分发 `workflow-presets` (tweak)
- 无预设匹配 → 按下表处理

| 活跃变更数 | 用户输入 | 行为 |
|-----------|---------|------|
| 无 | 非预设输入 | → 分发 `phase-open` |
| 1 个 | `/mumuspec <描述>` | → 询问：继续此变更或创建新变更 |
| 多个 | `/mumuspec <描述>` | → 询问：继续已有或创建新的；若继续则列出变更供选择 |
| 1 个 | `/mumuspec` 无描述 | → 自动选择，进入阶段检测 |
| 多个 | `/mumuspec` 无描述 | → 列出变更供用户选择 |

---

## 恢复规则

- 每次上下文恢复时，重新执行 Step 0-3，不依赖会话历史进行阶段检测
- 若有活跃变更且 worktree 有未提交更改，通过 dirty-worktree 协议处理
- 若 `phase: build`，先检查 `build_pause`、`build_mode`、`isolation`：
  - 全部已设置 → 读取下一个未完成任务继续执行
  - 未设置 → 返回 `phase-build` 补充

---

## 阶段流转

<IMPORTANT>
单次 `/mumuspec` 调用从检测到的阶段开始，在退出条件满足时自动推进到下一阶段。

**连续执行要求**：从检测到的阶段开始，Agent 自动继续后续所有阶段。但**自动推进仅在无用户决策的转换点生效**。遇到用户决策点时，**必须使用当前平台可用的用户输入/确认机制暂停并等待用户显式响应**。不得用推荐规则、默认值或历史偏好替代用户确认。
</IMPORTANT>

### 决策点为阻塞点

遇到以下任一节点时，当前调用必须停止，等待用户选择：

1. Open 阶段提案/设计/任务审查确认 (BP-3)
2. Brainstorming 中确认设计方向 (BP-4)
3. Build 阶段 plan-ready 暂停选择 (BP-9)
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

## 子命令快速参考

| 命令 | 阶段 | 管理方 | 核心工件 |
|------|------|--------|---------|
| `phase-open` | 1. Open | MumuSpec | proposal.md, delta-specs/, cognitive-map.yaml(预热) |
| `phase-design` | 2. Design | MumuSpec + 外部 Skill | design.md, cognitive-map.yaml, test-cases/, constraints/ |
| `phase-build` | 3. Build | 外部 Skill | tasks.md, suite-map.yaml, 代码提交 |
| `phase-verify` | 4. Verify | MumuSpec + 外部 Skill | verify.md, 分支处理 |
| `phase-archive` | 5. Archive | MumuSpec | 主规范合并, 知识提取, 归档记录 |
| `workflow-presets` | 预设 | 两者 | hotfix/tweak 快速路径 |

```
/mumuspec
  ↓ 自动检测
/phase-open ──→ /phase-design ──→ /phase-build ──→ /phase-verify ──→ /phase-archive

workflow-presets (hotfix)
  open ──→ build ──→ verify ──→ archive
    ↑ 升级触发 → 阻塞确认 → 补充 Design → 回到 full 工作流

workflow-presets (tweak)
  open ──→ lightweight build ──→ light verify ──→ archive
    ↑ 升级触发 → 阻塞确认 → 补充 Design → 回到 full 工作流
```

---

## 交互模式

### 结构化菜单（推荐）

当用户不确定下一步时，呈现菜单：

```
📋 当前变更: feature-auth [design] (full workflow)

已完成:
  ✅ proposal.md
  ✅ delta-specs/ (2 specs)
  ✅ affected_scopes 定义
  ✅ constraints/

待完成:
  ⬜ 技术设计 (design.md)
  ⬜ 测试用例 (test-cases/)

建议下一步: 进入 Design 阶段

可执行操作:
  1. 开始技术设计 → 触发 phase-design
  2. 查看当前状态 → mumuspec status feature-auth
  3. 运行校验 → mumuspec check
  4. 回退 → 回到上一阶段

(输入编号选择，或直接描述需求)
```

### 直接编排（高效模式）

当用户明确知道要做什么时，直接执行：

- "开始设计" → 触发 `phase-design`
- "写测试用例" → 触发 test-case 设计流程
- "继续实现" → 触发 `phase-build`
- "验证完了归档" → 触发 `phase-archive`

---

## .mumuspec.yaml 字段参考

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

---

## 约束

- 编排器 SHALL NOT 直接编写代码或修改文件（由阶段 Skill 执行）
- 编排器 SHALL NOT 跳过状态检测直接进入阶段
- 每次操作前 SHALL 确认用户意图（可通过 AskQuestion 或直接命令）
- 操作异常时 SHALL 显示错误详情和修复建议

---

## 与其他 Skill 的关系

编排器是**调度中心**，不包含具体实现逻辑。具体步骤由阶段 Skill 执行：

```
mumuspec (编排器)
  ├── phase-open      # Open 阶段：需求探索、scope 定义
  ├── phase-design    # Design 阶段：技术设计、认知框架、hyperplan
  ├── phase-build     # Build 阶段：TDD 实现、代码编写
  ├── phase-verify    # Verify 阶段：验证、审查
  ├── phase-archive   # Archive 阶段：合并、归档
  └── workflow-presets # 预设路径：hotfix/tweak 快速工作流
```
