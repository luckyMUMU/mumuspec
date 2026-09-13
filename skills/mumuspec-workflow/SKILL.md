---
name: mumuspec-workflow
description: "Drive AI-assisted development through the MumuSpec spec-as-DSL change lifecycle: open → design → build → verify → archive. 触发词：开始/继续一个变更、写或审 spec/设计、跑阶段门禁、合规与漂移检查、归档变更；仓库存有 .mumuspec/ 即适用。Use when the user asks to start a change, write/review a spec or design, run phase guards, check compliance or drift, or archive a completed change in a MumuSpec-managed repository (marked by .mumuspec/)."
license: MIT
metadata:
  author: MumuSpec Contributors
  version: 0.33.0
  homepage: https://github.com/mumuspec/mumuspec
---

# MumuSpec Workflow — 编排决策核

MumuSpec 是 spec-as-DSL 引擎：规范树（`.mumuspec/`）是 WHAT 的事实源，外部 Skill 决定 HOW，
Guard Layer 以退出码兜底校验。本文件是**编排决策核**：从一次用户请求判定阶段并分发到
phase skill。分发表的唯一数据源是 `skills/mumuspec/workflow.yaml`。

## 输出语言规则

使用触发本工作流的用户请求的语言。恢复已有变更时，若工件已有明确主导语言，保持不变。

## 核心不变量（不可违反）

1. **设计决策权在人。** 为审查起草工件（proposal/design/open-questions/assumptions），
   绝不自批阻塞点（BP）——人通过 decisions.md 锚点或显式确认签收。
2. **单活跃变更**（按 scope/branch，`mumuspec new` 强制）。
3. **自上而下设计、自下而上实现**：设计从根目录开始，实现从叶子目录开始。
4. **测试用例是设计产出**：Design 阶段锁定后，Build 期间改测试是过程违规（W-GUARD-004）。
5. **SHALL NOT 是硬约束**：`mumuspec check` / `guard` 的 exit-code 失败必须修复，不可绕说。

## 编排决策核（Decision Core）

### Step 0: 预设检测（最高优先级）

- 用户描述 Bug 修复 + 满足 hotfix 条件（≤2 文件、无接口/架构变更）→ 分发 `workflow-presets` (hotfix)
- 用户描述文案/配置/文档微调 + 满足 tweak 条件（≤4 文件、无新能力、无 delta spec）→ 分发 `workflow-presets` (tweak)
- 无预设匹配 → Step 1

### Step 1: 活跃变更发现与状态读取

```bash
mumuspec list             # 活跃变更列表
mumuspec status <name>    # phase + workflow + 就绪动作引导
```

- 无活跃变更 → 分发 `phase-open`
- 1 个活跃变更：用户有描述 → 询问"继续此变更或创建新变更"；`/mumuspec` 无描述 → 自动选择进入 Step 2
- 多个活跃变更 → 列出让用户选择继续哪个，或创建新的
- **下一跳以 `mumuspec status <name>` 输出的就绪动作引导为权威**，不靠会话历史或本文件复述判定规则

### Step 2: 阶段 → Skill 分发

| phase / 状态 | 分发 |
|---|---|
| open | `/phase-open` |
| design | `/phase-design` |
| build | `/phase-build` |
| verify | `/phase-verify` |
| archive-in-progress（verify_result: pass） | `/phase-archive` |
| verify_result: fail | 停在 BP-14，等待用户选择修复或接受偏差 |
| archived / archive-completed | 工作流已完成，提示创建新变更 |

### 阻塞点：必须暂停等待用户显式响应

| BP | 阶段 | 决策 |
|---|---|---|
| BP-1/2/3 | Open | 需求澄清、PRD 拆分、工件审查 |
| BP-4~8 | Design | 设计方案、grill-me 共识、认知框架 Q2/Q3、Hyperplan、测试锁定 |
| BP-9~13 | Build | 计划就绪+配置、分支命名、规范增量、范围扩展 |
| BP-14~16 | Verify | 验证失败、Spec 漂移、分支处理 |
| BP-17 | Archive | 归档最终确认 |
| BP-18 | 预设 | 升级条件触发 |

Red Flags——出现以下想法即 STOP：
"用户可能同意" / "小变更不用确认" / "用户上次选了 A 这次也是" /
"我解释了用户没反对" / "流程到这里应该没问题"。**不反对 ≠ 同意；历史偏好 ≠ 当前确认。**

## 生命周期速查

| 阶段 | 你要做的 | 出口门禁（硬） |
|---|---|---|
| open | `mumuspec new <name>`；写 proposal.md；登记决策 | proposal.md 非空（E-CHANGE-*） |
| design | 写 design.md；起草 open-questions.yaml；提出测试用例 | open-questions.yaml 完备性门禁（fail-closed）；design.md 存在 |
| build | 按并行组自下而上实现；`mumuspec guard <change> verify`（`<phase>` 是目标阶段） | build_layers 全 done（E-GUARD-002）；同层耦合 W-BUILD-001；assumptions.yaml 门禁（full） |
| verify | 跑测试；`mumuspec check`；`mumuspec drift`；修复或记录漂移 | verify_result=pass（E-VERIFY-001）；分支已处理（E-VERIFY-002） |
| archive | `mumuspec archive <name> --confirm`（随后 `finalize-archive`） | BP-17 人工确认 |

预设：hotfix / tweak 跳过 design（open → build 捷径），差异在归档侧是否执行合并副作用。

## "该校验跑哪个命令"路由表

不确定用哪个 → 先查 `mumuspec capability`（命令能力分层查询）。

| 目的 | 命令 |
|---|---|
| 合规 + 漂移 + 术语聚合（exit code 即裁决） | `mumuspec check` |
| spec 格式校验 + Enforcement 覆盖报告 | `mumuspec validate` |
| 阶段出口门禁（`<phase>` 是**目标**阶段；`--apply` 才转换） | `mumuspec guard <change> <target-phase> --apply` |
| spec↔code 漂移检测 | `mumuspec drift --change <n>` |
| 代码图谱一致性 | `mumuspec graph verify --change <n>` |
| 契约校验 / 契约漂移 | `mumuspec contract verify --change <n>` / `mumuspec contract drift --change <n>` |
| 测试不可变性 | `mumuspec test-cases verify <name>` |
| 代码 ↔ 持久化对齐 | `mumuspec sync` |
| 环境诊断 | `mumuspec doctor` |
| 就绪动作 / 状态查询 | `mumuspec status <name>` / `mumuspec list` |

## Guard 与 State 双通道

| 维度 | `guard <change> <target> --apply` | `state transition <name> <next> --confirm` |
|---|---|---|
| 校验 | 完整 Phase Guard（工件/锁/hash/计数） | 仅目标阶段合法性 + BP 确认标记 |
| 绕过审计 | —（guard 本身即校验） | 写 audit-log `state.confirm_bypass`；`guard.bypass_audit: false` 时直接拒绝（E-STATE-001） |
| 适用 | **标准路径（推荐）** | 确知状态正确而 guard 误报的例外路径 |

**常见 guard 错误速查表：**

| 错误码 | 含义 | 修复 |
|---|---|---|
| W-DESIGN-001 | cognitive-map.yaml 不存在 | 产出该文件（或关闭 `cognitive_framework`） |
| W-DESIGN-002 | Q1 已知的已知为空 | 确保 `cognitive_framework.q1_count > 0` |
| W-DESIGN-005 | Q4 扫描不足 | 补 Q4 blind-spot 条目至 `q4_scans_completed >= 3` |
| W-DESIGN-006 | 认知地图未收敛 | 清空 q2_pending/q3_pending 后置 `converged: true` |
| E-GUARD-009 / W-GUARD-009 | 设计覆盖断链（I1） | `mumuspec state layers <name>` 查层级，补齐缺层 design 产物 |
| W-BUILD-001 | 同层 scope 耦合（I3） | `mumuspec state plan-parallel <name>`，拆层或合并模块 |
| E-CHANGE-006 | Unknown target phase | 用 `state transition`，不用 `guard` |

确定性修复：`mumuspec cognitive-map sync <name>`（从 cognitive-map.yaml 重算计数）。
认知框架四项均为**告警**（W-DESIGN-*）；判某码是否真会触发看发出点，不看注册表。

## .mumuspec.yaml 字段参考

```yaml
workflow: full                   # full|hotfix|tweak|loop
phase: build                     # open|design|build|verify|archive-in-progress|archive-completed|discarded
design_doc: design.md
cognitive_map: cognitive-map.yaml
plan: tasks.md
base_ref: a1b2c3d4e5f6
build_mode: null                 # executing-plans|subagent-driven-development|direct
build_pause: null                # null|plan-ready
isolation: null                  # branch|worktree
tdd_mode: tdd                    # 默认 tdd，可配置 (default_tdd_mode)
verify_mode: null                # light|full
verify_result: pending           # pending|pass|pass-with-deviations|fail
verification_report: null
branch_status: pending           # pending|handled
created_at: 2026-07-10
verified_at: null
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

> 终态由 `phase` 表达（archive-completed / discarded），不存在 `archived` 字段。

## 错误码纪律

每次 guard/校验失败都带错误码（`E-CHANGE-*`、`E-GUARD-*`、`E-VERIFY-*`、`E-SPEC-*`、
`E-AGENTS-*`）。读码 → 按打印的 fixHint 修复 → 重跑门禁。绝不在没有证明性检查的情况下
标记门禁通过；`W-*` 是告警，必须上报给人，不可静默忽略。

## 常见问题处置

- Spec 不清楚 → 问人，答案记入 `decisions.md`（`## [phase] timestamp` 锚点）。不得编造需求。
- 约束挡住任务 → 停下来上报冲突；例外走 `constraint_strength` 覆盖流程，不可静默绕过。
- 无活跃变更但被要求改代码 → 先 `mumuspec new`；游离编辑绕开上述一切保障。
- spec 模块文件改动后出现 E-AGENTS-001 → `node scripts/regen-rules.mjs` 是唯一修法。
- 携带 delta-spec 的变更必须走 hotfix 路径语义（tweak 归档会跳过 delta 合并）。

## 与其他 Skill 的关系

```
mumuspec-workflow（本文件：编排决策核）
  ├── phase-open / phase-design / phase-build / phase-verify / phase-archive
  ├── workflow-presets（hotfix / tweak 快速路径）
  └── skills/mumuspec/workflow.yaml（分发表 + BP 结构化定义，唯一数据源）
```

MCP 等价面：`mumuspec-mcp` 暴露 38 个只读工具（get_spec_context、check_compliance、
detect_drift、guard_check 等）。写操作（new/transition/archive）按设计留在 CLI。
