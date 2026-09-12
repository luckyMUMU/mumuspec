---
name: workflow-presets
description: "MumuSpec 预设路径: Hotfix（Bug 修复）和 Tweak（小变更）。以 /workflow-presets 启动。跳过 Design，适用于快速变更场景。"
---

# MumuSpec 预设路径 — Hotfix & Tweak

> **phase**: preset · **workflow**: `hotfix|tweak`

预设路径是 MumuSpec 的快捷工作流，跳过 brainstorming 和 Design，适用于不涉及新能力设计的行为修复或局部优化。

---

## Hotfix（Bug 修复）

**适用条件**（必须全部满足）：
1. 修复现有功能的 Bug，无新能力
2. 无接口变更或架构调整
3. 变更范围可预测（通常 ≤ 2 文件）

**执行链**：open → build → verify → archive

**阻塞点**：
- BP-3: 工件审查确认（简化版）
- BP-14: 验证失败决策
- BP-16: 分支处理选择
- BP-17: 归档最终确认
- BP-18: 升级条件触发确认

### 关键约束

- **TDD 不豁免**（默认 tdd 下）：即使跳过 Design，红绿 TDD 循环和测试不可变性约束仍然强制适用
- **测试用例必须在 Open 阶段定义并锁定**：hotfix 虽跳过 Design，仍须定义单层 test-cases/

### 快速 Open（复用 phase-open 简化版）

创建简化工件：
- `proposal.md` — 问题描述 + 根因分析 + 修复目标（无需方案对比）
- `delta-specs/` — 仅当修复改变既有 spec 验收场景时创建
- `test-cases/layer-0-cases.md` — 单层测试用例
- `suite-map.yaml`（单层映射）

初始化状态：
```bash
mumuspec state init <name> hotfix
```

运行 Phase Guard 转换 open → build：
```bash
mumuspec guard <name> build --apply
```

> **注意**：hotfix 走 `open_to_build_hotfix` 守卫，不走 `open_to_design`。不执行认知框架，无 cognitive-map.yaml。

### 直接 Build

使用 hotfix 默认值：`build_mode: direct`。跳过 `writing-plans`（除非任务 > 3）。

1. 读取 `tasks.md`，对每个未完成任务：
   - **RED**：编写测试 → 验证失败
   - 锁定测试套件 hash
   - **GREEN**：编写修复代码使测试通过
   - **REFACTOR**：重构优化
   - 勾选任务并提交
2. 所有任务完成后，运行相关测试和构建命令

#### 调试门禁

执行中出现崩溃/异常/测试失败/构建失败时，**立即执行**加载 `systematic-debugging` skill。根因调查完成前不得修改源码。

### 根因消除检查

运行 build guard 前执行，确保修复真正消除了根因：
1. 读取 proposal.md 中的 Bug 描述和根因
2. 搜索并验证问题代码已不存在
3. 若根因未消除 → 返回继续修复

### 验证

复用 `phase-verify`，由规模评估决定 light 或 full 验证。

### 归档

复用 `phase-archive`。若有 delta spec，同步到主 spec。

---

## Tweak（小变更）

**适用条件**（必须全部满足）：
1. 变更范围可预测（通常 ≤ 4 文件）
2. 无新增能力需求
3. 不涉及 delta spec
4. 修改不改变接口语义

**执行链**：open → lightweight build → light verify → archive

**阻塞点**：
- BP-3: 工件审查确认（极简版）
- BP-14: 验证失败决策
- BP-16: 分支处理选择
- BP-17: 归档最终确认
- BP-18: 升级条件触发确认

### 关键约束

- **TDD 不豁免**（默认 tdd 下）：即使 tweak，红绿 TDD 循环和测试不可变性约束仍强制适用
- **测试用例必须在 Open 阶段定义并锁定**：tweak 须定义单层 test-cases/

### 快速 Open（极简版）

创建极简工件：
- `proposal.md` — 变更目标（1-2 段即可）
- `tasks.md` — 预填 1-3 个任务
- `test-cases/layer-0-cases.md` — 单层测试用例
- `suite-map.yaml` — 单层映射

**不创建**：
- `delta-specs/`（tweak 不涉及 spec 变更）
- `constraints/`（不新增约束）
- `cognitive-map.yaml`（不执行认知框架）
- `code-graph/impact-analysis.json`（不执行影响分析）

初始化状态：
```bash
mumuspec state init <name> tweak
```

运行 Phase Guard 转换 open → build：
```bash
mumuspec guard <name> build --apply
```

> **注意**：tweak 走 `open_to_build_tweak` 守卫，不走 `open_to_design`。

### 轻量 Build

使用 tweak 默认值：`build_mode: direct`，`isolation: branch`。跳过 `writing-plans`（tasks.md 已预填）。

1. 读取 `tasks.md`，对每个未完成任务：
   - **RED**：编写测试 → 验证失败
   - 锁定测试套件 hash
   - **GREEN**：编写修改使测试通过
   - 勾选任务并提交
2. 所有任务完成后，运行相关测试

### 轻量验证

执行 5 项快速检查（不运行完整验证流程）：

1. 所有 tasks.md 任务完成 `[x]`
2. 变更文件匹配 tasks.md 描述
3. 构建通过
4. 相关测试通过
5. 无明显安全问题

**通过标准**：全部 OK，无 CRITICAL 问题。

### 归档

复用 `phase-archive`，但跳过 delta-spec 合并和知识提取。

归档操作（简化版）：
- 移动变更到 `archive/`
- 清理 worktree/branch
- 释放活跃变更槽位
- **不执行**知识提取（无 cognitive-map.yaml）
- **不执行**delta-spec 合并（无 delta-specs/）

> **陷阱（静默失败）**：`archive` 依据 `workflow === 'tweak'` 直接跳过 delta-spec 合并、工件合并与知识提取，
> 且**不报任何错**。若误在 tweak 中创建了 `delta-specs/`，规范增量会静默丢失（只留在归档目录里），
> 而 `validate` / `check` 一路全绿。
> **补救**：`mumuspec finalize-archive <change-name> --keep-old` —— 无条件执行 delta 合并 / prohibitions 更新 /
> index 重建 / code-graph 快照（marker 幂等，可安全重跑）；随后重新生成 Rules 文件消除 E-AGENTS-001。
> **本质**：tweak 与 hotfix 的差别不在 phase 列表（两者都 skip design），而在归档侧是否执行合并副作用。

---

## 升级条件

当预设路径中发现实际变更超出预设范围时，**必须暂停等待用户确认升级**。

### hotfix → full

升级到 full 当**任一**条件满足：

| 条件 | 说明 |
|------|------|
| 变更涉及 3+ 文件 | 超出单点修复范围 |
| 架构变更 | 新模块、新接口、新依赖 |
| 数据库 schema 变更 | 结构调整 |
| 引入新公共 API | 修复创建新外部接口 |
| 修复范围超出单个函数/模块 | 需协调变更 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

### tweak → full

升级到 full 当**任一**条件满足：

| 条件 | 说明 |
|------|------|
| 变更涉及 5+ 文件 | 超出小变更范围 |
| 跨模块协调 | 需跨组件协调 |
| 5+ 新测试用例 | 变更复杂度上升 |
| 配置项增删（非值修改） | 超出值调整范围 |
| 新增能力需求 | 超出局部优化 |
| 需要 delta spec | 影响既有规范 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

### 升级流程

**必须使用平台用户输入/确认机制暂停等待用户确认升级。** 不可直接进入 `phase-design`。

用户确认升级后，**必须先更新 workflow 和 phase 字段**：
```bash
mumuspec state set <name> workflow full
mumuspec state set <name> phase design
```

然后基于当前变更补充 Design Doc：**立即使用 Skill 工具加载 `phase-design`**，进入正常 full 工作流。

若用户不确认升级，停止预设工作流并报告当前变更已超出预设范围。

---

## 领域 Skill 提示（伴随能力）

> 下列条目均为**伴随能力（companion，包外增强）**：可用则用，不可用不阻断流程，按本文内联步骤执行。
> **包内自足的必须步骤**是本文的编号步骤本身，不依赖任何外部 skill。
> 可用性由 `mumuspec skill companions` 统一枚举（代码侧探测，非模型现场判断）。

### Hotfix

| 场景 | 伴随能力 | companion |
|------|-----------|----------|
| 根因调查 | `systematic-debugging` | 是（触发时） |
| 安全边界 | `security-and-hardening` | 可选 |
| 验证 | `verification-before-completion` | 是 |
| 分支处理 | `finishing-a-development-branch` | 是 |
| CI/CD | `ci-cd-and-automation` | 是 |
| 归档 | `documentation-and-adrs` | 是 |

### Tweak

| 场景 | 伴随能力 | companion |
|------|-----------|----------|
| 验证 | `verification-before-completion` | 是 |
| 分支处理 | `finishing-a-development-branch` | 是 |
| CI/CD | `ci-cd-and-automation` | 是 |
| 归档 | `documentation-and-adrs` | 是 |
| 调试（触发时） | `systematic-debugging` | 可选 |

---

## Red Flags 自检表（预设路径共用）

| Agent 想法 | 实际风险 |
|-----------|---------|
| "hotfix 不需要 TDD" | TDD 不可豁免 — tdd_mode 遵循配置（默认 tdd） |
| "测试用例可以不锁定" | 即使预设路径也须定义并锁定 test-cases/ |
| "tweak 可以跳过 Ponytail" | Ponytail 合规检查在 build 阶段强制执行 |
| "范围扩大了继续做" | 超出条件必须升级 — BP-18 不可跳过 |
| "升级不用确认" | 必须用户确认升级 — 不可自动进入 full |
| "归档可以自动执行" | BP-17 归档确认不可跳过 |
| "调试时直接改代码" | 根因调查完成前不得修改源码 |
| "hotfix/tweak 不需要 knowledge extraction" | 正确 — 预设路径跳过知识提取 |
| "tweak 可以创建 delta-spec" | 不涉及 spec 变更 — 需要 delta spec 即升级 |
