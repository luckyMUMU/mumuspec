---
name: mumuspec-hotfix
description: "MumuSpec 预设路径: Bug 修复 / 热修复。以 /mumuspec-hotfix 启动。跳过 Design，直接 open → build → verify → archive。TDD 不豁免。"
phase: hotfix
workflow: hotfix
---

# MumuSpec 预设路径: Hotfix（快速 Bug 修复）

快速 Bug 修复工作流：open → build → verify → archive。跳过 brainstorming 和 Design，适用于不涉及新能力设计的行为修复。

**适用条件**（必须全部满足）：
1. 修复现有功能的 Bug，无新能力
2. 无接口变更或架构调整
3. 变更范围可预测（通常 ≤ 2 文件）

**不适用**：若修复过程发现需要架构调整，应升级到 full `/mumuspec` 工作流。

---

## 快速决策（Decision Core）

**执行链**：open → build → 根因检查 → verify → archive

**阻塞点**：
- BP-3: 工件审查确认（简化版）
- BP-14: 验证失败决策
- BP-16: 分支处理选择
- BP-17: 归档最终确认
- BP-18: 升级条件触发确认

**关键约束**：
- **TDD 不豁免**：即使跳过 Design，红绿 TDD 循环和测试不可变性约束仍然强制适用
- **测试用例必须在 Open 阶段定义并锁定**：hotfix 虽跳过 Design，仍须定义单层 test-cases/

---

## 执行步骤（预设工作流，6 步）

### Step 0: 输出语言约束

简化的工件必须使用触发本工作流的用户请求的语言。

### Step 1: 快速 Open（预设 open）

复用 MumuSpec open 能力创建变更，但使用 hotfix 默认值：不执行 `brainstorming` 长探索，直接进入简化变更创建。

**立即执行**：使用 Skill 工具加载 `openspec-new-change` skill（或 MumuSpec 等效命令）。

创建简化工件：
- `proposal.md` — 问题描述 + 根因分析 + 修复目标（无需方案对比）
- `delta-specs/` — 仅当修复改变既有 spec 验收场景时创建
- `constraints/new-shall-not.md` — 记录新增 SHALL NOT（若有）

**hotfix 独有：定义并锁定单层测试用例**
- 创建 `test-cases/layer-0-cases.md`
- 创建 `suite-map.yaml`（单层映射）
- 计算并锁定 hash：`test_cases.design_locked: true`
- `tdd_mode: tdd`（固定）

初始化状态：
```bash
mumuspec state init <name> hotfix
mumuspec state check <name> open
```

运行 Phase Guard 转换 open → build：
```bash
mumuspec guard <name> open --apply
```

> **注意**：hotfix 走 `open_to_build_hotfix` 守卫，不走 `open_to_design`。不执行认知框架，无 cognitive-map.yaml。

### Step 2: 直接 Build（预设 build）

使用 hotfix 默认值：`build_mode: direct`。跳过 `writing-plans`（除非任务 > 3）。

> 若任务超过 3 个，转入 `/mumuspec-build` 的计划和执行方式选择 — 注意这**不触发** full 工作流升级，仅切换执行方式。

**立即执行**：按 tasks.md 逐任务执行：

1. 读取 `tasks.md`，获取未完成任务列表
2. 对每个未完成任务：
   - **RED**：依据 `test-cases/layer-0-cases.md` 编写测试 → 验证失败
   - 锁定测试套件 hash
   - **GREEN**：编写修复代码使测试通过
   - **REFACTOR**：重构优化（不改测试）
   - 运行 Enforcement 检查
   - Ponytail 合规检查
   - 勾选 `- [ ]` → `- [x]`
   - 提交代码：`fix: <简要修复描述>`
3. 所有任务完成后，显式运行相关测试和构建命令

#### 调试门禁

执行中出现崩溃/异常/测试失败/构建失败时，**立即执行**加载 `systematic-debugging` skill。根因调查完成前不得修改源码。

### Step 3: 根因消除检查

> **领域 Skill 提示**：根因调查加载 `systematic-debugging`。若修复跨越安全边界，加载 `security-and-hardening`。

运行 build guard 前执行，确保修复真正消除了根因：

1. 读取 proposal.md 中的 Bug 描述和根因
2. 搜索并验证问题代码已不存在
3. 若根因未消除 → 返回 Step 2 继续修复（仍在 build 阶段，无需状态转换）

**升级条件检查**：
- 根因检查发现深层架构问题 → 停止 hotfix，按"升级条件"处理
- 修复需要额外接口变更 → 停止 hotfix，按"升级条件"处理

运行 Phase Guard 转换 build → verify：
```bash
mumuspec guard <name> build --apply
```

### Step 4: 验证（预设 verify）

复用 `/mumuspec-verify`，由 mumuspec-verify 的规模评估决定 light 或 full 验证。

**立即执行**：使用 Skill 工具加载 `mumuspec-verify` skill。

小规模 hotfix（无 delta spec，≤ 3 任务，≤ 2 文件）通常满足轻量验证条件（5 项快速检查）。

若 hotfix 创建了 delta spec，按规模评估规则进入完整验证路径。

验证通过后记录 `verify_result: pass`，仍须进入归档最终确认 — 不可自动运行归档脚本。

### Step 5: 归档（预设 archive）

复用 `/mumuspec-archive`。必须满足 `verify_result: pass` 后才可归档，等待归档最终确认 (BP-17)。

**立即执行**：使用 Skill 工具加载 `mumuspec-archive` skill。

若有 delta spec，同步到主 spec。归档时执行知识提取（简化版：仅从 decisions.md 提取关键决策）。

---

## 连续执行模式

<IMPORTANT>
Hotfix 工作流是**一次性连续执行**。调用 `/mumuspec-hotfix` 后，Agent 自动推进 hotfix 各步骤，中途不暂停等待用户输入。

以下情况必须暂停等待用户确认：
1. 工件审查确认 (BP-3) — 简化版，展示 proposal.md 和 test-cases 摘要
2. 遇到升级条件 (BP-18) — **必须暂停等待用户确认升级**
3. 任务超过 3 个时的工作区隔离和执行方式选择 (BP-10)
4. verify 阶段验证失败和分支处理决策 (BP-14, BP-16)
5. 归档最终确认 (BP-17)

执行顺序：快速 open → 直接 build → 根因检查 → 验证 → 归档 → 完成
</IMPORTANT>

---

## 升级条件 — BLOCKING POINT (BP-18)

升级到 full `/mumuspec` 当**任一**条件满足：

| 条件 | 说明 |
|------|------|
| 变更涉及 3+ 文件 | 超出单点修复范围 |
| 架构变更 | 新模块、新接口、新依赖 |
| 数据库 schema 变更 | 结构调整 |
| 引入新公共 API | 修复创建新外部接口 |
| 修复范围超出单个函数/模块 | 需协调变更 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

**必须使用平台用户输入/确认机制暂停等待用户确认升级。** 不可直接进入 `/mumuspec-design`，不可自动补充 Design Doc。

用户确认升级后，**必须先更新 workflow 和 phase 字段**：
```bash
mumuspec state set <name> workflow full
mumuspec state set <name> phase design
```

然后基于当前变更补充 Design Doc：**立即使用 Skill 工具加载 `mumuspec-design` skill**，进入正常 full 工作流。

若用户不确认升级，停止 hotfix 并报告当前变更已超出 hotfix 范围。

---

## 退出条件

- Bug 已修复，测试通过
- 变更已归档
- 若 spec 变更，已同步到主 spec
- **Phase Guard**：build → verify 运行 `mumuspec guard <name> build --apply`；verify → archive 运行 `mumuspec guard <name> verify --apply`

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "hotfix 不需要 TDD" | TDD 不可豁免 — tdd_mode 固定为 tdd |
| "测试用例可以不锁定" | 即使 hotfix 也须定义并锁定 test-cases/ |
| "根因不重要，能修就行" | 根因消除检查是必要步骤 — 确保修复有效 |
| "范围扩大了继续做" | 超出条件必须升级 — BP-18 不可跳过 |
| "升级不用确认" | 必须用户确认升级 — 不可自动进入 full |
| "hotfix 可以跳过 Ponytail" | Ponytail 合规检查在 build 阶段强制执行 |
| "归档可以自动执行" | BP-17 归档确认不可跳过 |
| "调试时直接改代码" | 根因调查完成前不得修改源码 |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required |
|------|-----------|----------|
| 根因调查 | `systematic-debugging` | true (触发时) |
| 安全边界 | `security-and-hardening` | false |
| 验证 | `verification-before-completion` | true |
| 分支处理 | `finishing-a-development-branch` | true |
| CI/CD | `ci-cd-and-automation` | true |
| 归档 | `documentation-and-adrs` | true |
