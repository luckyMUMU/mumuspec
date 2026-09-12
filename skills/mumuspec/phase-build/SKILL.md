---
name: phase-build
description: "MumuSpec Phase 3: Build。以 /phase-build 启动。自下向上实现 + 红绿 TDD + Ponytail 合规检查 + 代码图谱增量更新。"
---

# Phase: Build — 实现（自下向上 + 红绿 TDD）

> **阶段**: 3 · **workflow**: full

## 快速决策（Decision Core）

**前置条件**：Design 阶段完成（design.md + test-cases/ 已锁定）

**阻塞点**：
- BP-9: 计划就绪暂停选择
- BP-10: 工作区隔离 + 执行方式 + TDD 模式选择
- BP-11: 分支命名确认
- BP-12: 规范增量更新（中型）
- BP-13: 范围扩展拆分决策

**退出条件**：所有 tasks.md 完成，代码提交，Ponytail 合规检查通过，测试全绿，Phase Guard 通过

**实现原则**：自下向上（Layer N → Layer 0）+ 红绿 TDD（Red→Green→Refactor）

---

## 前置条件

- Design 阶段完成（design.md + cognitive-map.yaml + test-cases/ 已锁定）
- 活跃变更存在
- `tdd_mode` 遵循配置（默认 `tdd`，可配置为 non-tdd）

---

## 执行步骤

### Step 0: 输出语言约束

实现计划、代码注释、执行反馈必须使用触发本工作流的用户请求的语言。

**幂等性**：可安全重复执行。

### Step 1: 入口状态验证

```bash
mumuspec state check <name> build
```

**幂等性**：读取 `.mumuspec.yaml` 的 `phase` 确认仍在 build，读取 `base-ref.txt`，使用 `mumuspec tasks next <name>` 定位第一个未完成任务（行号 + 剩余计数）。已提交的任务不重复提交。

### Step 2: 创建实现计划

**立即执行**：使用 Skill 工具加载 `writing-plans` skill。

> **降级说明**：若 `writing-plans` skill 不可用，按以下方式手动创建 `tasks.md`：

```markdown
# Implementation Tasks: <change-name>

## Layer <N>: <层名称>
- [ ] <任务描述>
  - 文件: <受影响的文件>
  - 验收: <如何验证>

## Layer <N-1>: <层名称>
- [ ] <任务描述>
```

手动创建规则：
- 每个任务必须可独立验证（有明确的"完成"定义）
- 每个任务标注受影响的文件路径
- 按照 `build_layers` 从最深（叶子）到最浅（根）排序
- 每个 task 包含 Red-Green 步骤：先写失败测试 → 再写实现 → 重构

创建计划：
- 保存到 `tasks.md`
- 参考设计文档，分解为可执行任务
- 按 `build_layers` 从叶子到根排序

**幂等性**：若 `tasks.md` 已存在，不重新创建。

### Step 3: 计划就绪暂停点 — BLOCKING POINT (BP-9)

计划记录后，提供用户决策点：

| 选项 | 行为 | 说明 |
|------|------|------|
| A | 继续执行 | 留在当前模型，进入 Step 4 选择隔离和执行方式 |
| B | 暂停切换模型 | 记录 `build_pause: plan-ready`，停止本次调用 |

**必须使用平台用户输入/确认机制暂停等待用户选择。** 不可自动继续，不可将暂停写入 `build_mode`。

用户选择继续时：`mumuspec state set <name> build_pause null`
用户选择暂停时：`mumuspec state set <name> build_pause plan-ready`，然后停止。

### Step 4: 工作流配置选择 — BLOCKING POINT (BP-10)

**必须一次性同时询问工作区隔离和执行方式**：

#### 工作区隔离

| 选项 | 方法 | 说明 |
|------|------|------|
| A | 创建 branch | 在当前仓库创建新分支，简单快速 |
| B | 创建 Worktree | 隔离工作区，完全独立 |

#### 执行方式

| 选项 | Skill | 适用场景 |
|------|------|---------|
| A | `subagent-driven-development` | 独立任务、高复杂度、需两阶段审查 |
| B | `executing-plans` | 简单任务、无子 agent 环境 |

**TDD 模式**：遵循配置（默认 `tdd`，可配置为 non-tdd）

**必须使用平台用户输入/确认机制暂停等待用户显式选择。** 推荐规则仅供建议，不可替代用户确认。

选择后更新状态：
```bash
mumuspec state set <name> isolation <branch|worktree>
mumuspec state set <name> tdd_mode tdd   # 默认 tdd，可配置 (default_tdd_mode)
```

- 选择 `executing-plans`：`mumuspec state set <name> build_mode executing-plans`
- 选择 `subagent-driven-development`：确认平台有真实后台子 agent 能力后，`mumuspec state set <name> build_mode subagent-driven-development`
  （**注意**：不存在 `subagent_dispatch` 字段——分发粒度由 `mumuspec state layers` 的并行组决定，见 Step 5）

#### 执行隔离 — BLOCKING POINT (BP-11)

**branch**：基于 workflow 类型和日期推荐分支名，**必须暂停等待用户确认或输入自定义名**：
- `full` → `feature/YYYYMMDD/<change-name>`
- `hotfix` → `hotfix/YYYYMMDD/<change-name>`
- `tweak` → `tweak/YYYYMMDD/<change-name>`

**worktree**：**立即执行**加载 `using-git-worktrees` skill。

### Step 5: 按并行组实现（组内并行 + 组间自下而上）

> **视野纪律**：设计时视野向上（Level 0..N），实现时视野向下（Level N 及其更低层）。
> 层内模块默认**可并行**——只要它们之间不存在直接调用边。并行度是设计完备性的投影：
> 同层模块无法并行，说明设计没闭合，应回退 Design 而不是靠加班解决。

#### 先取事实：并行组

```bash
mumuspec state layers <name>            # 层级表 + 并行组 + 候选组（只读）
mumuspec state plan-parallel <name>     # 读 code-graph 验证候选组（只读）
mumuspec state plan-parallel <name> --apply   # 写回 parallel_group / depends_on
```

- `parallel groups: [[a, b], [c]]` 即"可同时开工的模块集合"。
- 若命令报出 **same-layer coupling**（`scopes ⇄ scopes`，附调用边证据），说明该"同层"是伪装的：
  两个 scope 实际耦合。**回退 Design** 重新划层，或合并为一个模块；不要并行硬做。
- 输出 `candidate L<n> (same layer, unverified)` 时，先跑 `plan-parallel` 再开工。

#### 执行顺序

```
按 layer 自下而上：L0 → L1 → ... → Ln
  每个 layer 内部：组内各 scope 并行（可分发并行子 agent），组间按 depends_on 串行
```

层间顺序由 CLI 在写入时强制：低层未全部 `done` 时，`mumuspec state layer <name> <n> done` 会被拒绝
（`--force` 可越过，仅用于计划变更）。

#### 每个 scope 的实现流程

```
a. 加载该 scope 的规范 + test-cases/layer-N-cases.md
b. RED: 依据 cases.md 编写测试套件 → 验证测试失败
c. 锁定该层测试套件：`mumuspec test-cases lock-suite <name> --layer N`（确定性写入 state.suites_hash）
d. GREEN: 编写实现代码使所有测试通过
e. REFACTOR: 重构优化（不改测试）
f. 运行该 scope 的 Enforcement 检查（SHALL + SHALL NOT）
g. Ponytail 合规检查（见 Step 5b）
h. 代码图谱增量更新
i. `mumuspec state layer <name> N done --scope <scope>`（同层多 scope 时必须带 --scope）
j. 提交代码（worktree 内 git commit）
k. 勾选 tasks.md 对应任务
```

> **禁止越界**：实现 Level N 的模块时，不得引用同层兄弟模块未经冻结契约（`BOUNDARY.md`）导出的符号。
> 若确实需要，说明层内契约未冻结 → 回退 Design 补契约。

#### Step 5a: 执行方式分支

| `build_mode` | 含义 | 与并行组的关系 |
|--------------|------|----------------|
| `executing-plans` | 主会话按计划逐任务执行 | 组内串行执行 |
| `subagent-driven-development` | 主窗口仅协调，后台子 agent 分发 | **以并行组为单位分发**：一组一个子 agent；跨组遵守 layer 顺序 |

分发粒度由 `mumuspec state layers` 输出的并行组决定，**不靠 agent 自行判断**。

#### Step 5b: Ponytail 合规检查 — MumuSpec 独有

每层实现完成后执行 Ponytail 7 级优先级阶梯合规检查：

| 级别 | 检查项 | 违规后果 |
|------|--------|---------|
| 1 | YAGNI — 代码是否需要存在？ | E-PONYTAIL-001 WARN |
| 2 | 是否有已有实现可复用？ | 提示复用 |
| 3 | 标准库是否已提供？ | E-PONYTAIL-002 ERROR |
| 4 | 平台原生特性是否支持？ | E-PONYTAIL-002 ERROR |
| 5 | 已安装依赖是否能做？ | E-PONYTAIL-002 ERROR |
| 6 | 能否一行写完？ | E-PONYTAIL-003 WARN |
| 7 | 是否最小可工作实现？ | E-PONYTAIL-004 WARN |

> 有意简化必须用 `ponytail:` 注释标记原因。

#### Step 5c: 调试门禁

执行中出现崩溃/异常行为/测试失败/构建失败时，**立即执行**加载 `systematic-debugging` skill。根因调查完成前，不得提出或实施源码修复。

### Step 6: 规范增量更新

实现中发现 spec 不完整时，按规模处理：

| 规模 | 触发条件 | 处理方式 |
|------|---------|---------|
| 小 | 缺少验收场景、边界条件 | 直接编辑 delta-spec + design.md，追加 tasks.md |
| 中 | 接口变更、新组件、数据流变更 | **BP-12** — 必须暂停等待用户确认，然后加载 `brainstorming` 更新 |
| 大 | 全新能力需求 | **BP-13** — 必须暂停等待用户确认拆分；确认后通过 `phase-open` 创建独立变更 |

**50% 阈值**：若新增任务超过初始任务数的 50%，**必须暂停等待用户决定是否拆分为新变更**。

### Step 7: 代码审查门禁

**立即执行**：使用 Skill 工具加载 `requesting-code-review` skill。

- CRITICAL 审查发现（安全漏洞、数据丢失风险、构建/测试失败）必须先修复
- 非 CRITICAL 审查发现若接受，记录接受理由和影响范围到 tasks.md
- 若 skill 不可用，跳过但记录 `<!-- review skipped: skill unavailable -->`

### Step 8: 上下文管理

Build 是最长阶段，可能跨多个任务：

- **每个任务完成后**：立即勾选 tasks.md 对应任务，提交代码，使状态持久化
- **上下文压缩后**：运行 `mumuspec state check <change-name> build --recover`
- **长任务拆分**：单个任务超过 200 行代码变更时，考虑拆分为多个子任务和提交

---

## 退出条件

过程要求（agent 自律，非守卫检查项）：

- 所有 tasks.md 任务勾选 `[x]`
- 代码已提交；项目构建/测试显式运行并通过
- `isolation` / `build_mode` / `tdd_mode` 已写入且与配置一致
- 每个 scope 的 Enforcement 检查通过；代码图谱已更新
- 代码审查已执行（或记录跳过）

守卫真正校验的出口条件（`build_to_verify`，权威清单见
[docs/reference/phase-guards.md#build_to_verify](../../docs/reference/phase-guards.md)）：

- `build_layers` 全部 `status = done`（`E-GUARD-002`）
- `test_cases.design_locked` / `suites_locked`（`W-GUARD-004`）
- 同层 scope 无直接调用边（`W-BUILD-001`）
- `workflow=full` 时 `assumptions.yaml` 完备性门禁（`E-GUARD-008`）
- **Phase Guard**：`mumuspec guard <name> verify --apply`

---

## Phase Guard 调用（出口门禁）

```bash
mumuspec guard <change-name> verify --apply
```

> **参数语义（此前文档写错，2026-09-12 修正）**：`guard <change> <phase>` 的 `<phase>` 是**目标**阶段，
> 不是当前阶段。离开 Build 意味着目标是 `verify`。此前本文档写成 `guard <name> build`，
> 实际执行的是 `design_to_build`（即进入 Build 的那道门），**出口门禁从未被执行**。
>
> 检查项清单以 [docs/reference/phase-guards.md#build_to_verify](../../docs/reference/phase-guards.md)
> 为唯一权威源——本 skill 不再重复列举，避免"文档有、代码无"的第三态。

> **Ponytail 检查不属于守卫**：`ponytail_compliance_checked` 字段并不存在。Ponytail 合规由
> `mumuspec check` 的 `checkPonytail()` 独立通道承担（`E-PONYTAIL-001..004`）。

## 自动流转到下一阶段

```bash
mumuspec state next <change-name>
```

- `NEXT: auto` → 调用 `phase-verify`
- `NEXT: manual` → 提示用户手动运行 `phase-verify`

---

## 上下文压缩恢复

```bash
mumuspec state check <change-name> build --recover
```

恢复后：
1. 读取 `tasks.md` 找到第一个未完成任务
2. 确认 `tdd_mode` 已设置
3. 重新加载 `test-driven-development` skill（上下文压缩后需重新加载）
4. 从未完成任务继续

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "TDD 太慢，直接写代码" | TDD 不可豁免 — tdd_mode 遵循配置（默认 tdd） |
| "测试用例可以改一下" | 测试不可变性 — design_locked 后不可改测试 |
| "Ponytail 检查不重要" | Ponytail 由 `mumuspec check` 独立校验（E-PONYTAIL-001..004），不是守卫项但同样会被拦 |
| "调试时直接改代码" | 根因调查完成前不得修改源码 — 加载 systematic-debugging |
| "规范不完整，直接改 delta-spec" | 中型变更必须用户确认 — BP-12 |
| "范围扩大了，继续做" | 超 50% 阈值必须暂停 — BP-13 |
| "代码审查可以跳过" | CRITICAL 发现必须修复 — 不可带入 verify |
| "计划不用了，直接实现" | writing-plans 不可跳过 — 必须创建 tasks.md |
| "执行方式我来选" | 必须用户选择 — 推荐规则不替代确认 |
| "worktree 里有未提交的改" | 必须通过 dirty-worktree 协议处理 |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required |
|------|-----------|----------|
| 实现计划 | `writing-plans` | true |
| 上下文管理 | `context-engineering` | true |
| TDD 实现 | `test-driven-development` | true (固定) |
| 执行方式 | `executing-plans` / `subagent-driven-development` | true |
| 源码验证 | `source-driven-development` | false |
| 调试修复 | `systematic-debugging` | false (触发时) |
| 疑虑驱动 | `doubt-driven-development` | false |
| 工作区隔离 | `using-git-worktrees` | true (worktree 模式) |
| 代码审查 | `requesting-code-review` | true (退出前) |
| UI 组件构建 | `frontend-ui-engineering` | false |
| API 设计 | `api-and-interface-design` | false |
| 安全敏感 | `security-and-hardening` | false |
| 性能敏感 | `performance-optimization` | false |
