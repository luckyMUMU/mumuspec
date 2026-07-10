---
name: mumuspec-tweak
description: "MumuSpec 预设路径: 小变更（tweak）。以 /mumuspec-tweak 启动。跳过 Design，light build → light verify → archive。TDD 不豁免。"
phase: tweak
workflow: tweak
---

# MumuSpec 预设路径: Tweak（小变更）

小变更工作流：open → lightweight build → light verify → archive。跳过 brainstorming、Design 和完整 Verify，适用于文案、配置、文档或提示词的局部优化。

**适用条件**（必须全部满足）：
1. 变更范围可预测（通常 ≤ 4 文件）
2. 无新增能力需求
3. 不涉及 delta spec
4. 修改不改变接口语义

**不适用**：若变更需要设计决策或涉及架构/接口变更，应升级到 full `/mumuspec` 工作流。

---

## 快速决策（Decision Core）

**执行链**：open → lightweight build → light verify → archive

**阻塞点**：
- BP-3: 工件审查确认（极简版）
- BP-14: 验证失败决策
- BP-16: 分支处理选择
- BP-17: 归档最终确认
- BP-18: 升级条件触发确认

**关键约束**：
- **TDD 不豁免**：即使 tweak，红绿 TDD 循环和测试不可变性约束仍强制适用
- **测试用例必须在 Open 阶段定义并锁定**：tweak 须定义单层 test-cases/

---

## 执行步骤（预设工作流，5 步）

### Step 0: 输出语言约束

所有工件必须使用触发本工作流的用户请求的语言。

### Step 1: 快速 Open（预设 open）

创建极简变更工件，仅包含必要文件：

**立即执行**：使用 Skill 工具加载 `openspec-new-change` skill（或 MumuSpec 等效命令）。

创建极简工件：
- `proposal.md` — 变更目标（1-2 段即可）
- `tasks.md` — 预填 1-3 个任务
- `test-cases/layer-0-cases.md` — 单层测试用例（即使是文案/配置变更，也须定义验证用例）
- `suite-map.yaml` — 单层映射

**不创建**：
- `delta-specs/`（tweak 不涉及 spec 变更）
- `constraints/`（不新增约束）
- `cognitive-map.yaml`（不执行认知框架）
- `code-graph/impact-analysis.json`（不执行影响分析）

**hotfix/tweak 独有：定义并锁定单层测试用例**
- 计算并锁定 hash：`test_cases.design_locked: true`
- `tdd_mode: tdd`（固定）

初始化状态：
```bash
mumuspec state init <name> tweak
mumuspec state check <name> open
```

运行 Phase Guard 转换 open → build：
```bash
mumuspec guard <name> open --apply
```

> **注意**：tweak 走 `open_to_build_tweak` 守卫，不走 `open_to_design`。

### Step 2: 轻量 Build（预设 build）

使用 tweak 默认值：`build_mode: direct`，`isolation: branch`。跳过 `writing-plans`（tasks.md 已预填）。

**立即执行**：直接按 tasks.md 逐任务执行：

1. 读取 `tasks.md`，获取未完成任务列表
2. 对每个未完成任务：
   - **RED**：依据 `test-cases/layer-0-cases.md` 编写测试 → 验证失败
   - 锁定测试套件 hash
   - **GREEN**：编写修改使测试通过
   - 运行 Enforcement 检查（若适用）
   - Ponytail 合规检查（Level 6-7：最小变更原则）
   - 勾选 `- [ ]` → `- [x]`
   - 提交代码：`tweak: <简要描述>`
3. 所有任务完成后，显式运行相关测试

#### 调试门禁

执行中出现崩溃/异常/测试失败时，**立即执行**加载 `systematic-debugging` skill。根因调查完成前不得修改源码。

### Step 3: 轻量验证（预设 light verify）

执行 5 项快速检查（不运行完整验证流程）：

1. 所有 tasks.md 任务完成 `[x]`
2. 变更文件匹配 tasks.md 描述
3. 构建通过
4. 相关测试通过
5. 无明显安全问题

**通过标准**：全部 OK，无 CRITICAL 问题。

**跳过项**：spec 场景覆盖、设计文档深度对比、代码模式一致性建议、漂移检测。

验证通过后记录 `verify_result: pass`，仍须进入归档最终确认 — 不可自动运行归档脚本。

### Step 4: 归档（预设 archive）

复用 `/mumuspec-archive`，但跳过 delta-spec 合并和知识提取（tweak 不涉及 spec 变更和认知框架）。

**立即执行**：使用 Skill 工具加载 `mumuspec-archive` skill。

归档操作（简化版）：
- 移动变更到 `archive/`
- 清理 worktree/branch
- 释放活跃变更槽位
- **不执行**知识提取（无 cognitive-map.yaml）
- **不执行**delta-spec 合并（无 delta-specs/）

---

## 连续执行模式

<IMPORTANT>
Tweak 工作流是**一次性连续执行**。调用 `/mumuspec-tweak` 后，Agent 自动推进各步骤，中途不暂停等待用户输入。

以下情况必须暂停等待用户确认：
1. 工件审查确认 (BP-3) — 极简版，展示 proposal.md 和 test-cases 摘要
2. 遇到升级条件 (BP-18) — **必须暂停等待用户确认升级**
3. 验证失败和分支处理决策 (BP-14, BP-16)
4. 归档最终确认 (BP-17)

执行顺序：快速 open → 轻量 build → 轻量验证 → 归档 → 完成
</IMPORTANT>

---

## 升级条件 — BLOCKING POINT (BP-18)

升级到 full `/mumuspec` 当**任一**条件满足：

| 条件 | 说明 |
|------|------|
| 变更涉及 5+ 文件 | 超出小变更范围 |
| 跨模块协调 | 需跨组件协调 |
| 5+ 新测试用例 | 变更复杂度上升 |
| 配置项增删（非值修改） | 超出值调整范围 |
| 新增能力需求 | 超出局部优化 |
| 需要 delta spec | 影响既有规范 |
| 涉及新增 SHALL NOT | 需要完整设计审查 |

**必须使用平台用户输入/确认机制暂停等待用户确认升级。** 不可直接进入 `/mumuspec-design`，不可自动补充 Design Doc。

用户确认升级后，**必须先更新 workflow 和 phase 字段**：
```bash
mumuspec state set <name> workflow full
mumuspec state set <name> phase design
```

然后基于当前变更补充 Design Doc：**立即使用 Skill 工具加载 `mumuspec-design` skill**，进入正常 full 工作流。

若用户不确认升级，停止 tweak 并报告当前变更已超出 tweak 范围。

---

## 退出条件

- 变更已完成，测试通过
- 变更已归档
- **Phase Guard**：build → verify 运行 `mumuspec guard <name> build --apply`；verify → archive 运行 `mumuspec guard <name> verify --apply`

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "tweak 不需要 TDD" | TDD 不可豁免 — tdd_mode 固定为 tdd |
| "测试用例可以不锁定" | 即使 tweak 也须定义并锁定 test-cases/ |
| "tweak 可以跳过 Ponytail" | Ponytail 合规检查在 build 阶段强制执行 |
| "范围扩大了继续做" | 超出条件必须升级 — BP-18 不可跳过 |
| "升级不用确认" | 必须用户确认升级 — 不可自动进入 full |
| "归档可以自动执行" | BP-17 归档确认不可跳过 |
| "tweak 可以创建 delta-spec" | 不涉及 spec 变更 — 需要 delta spec 即升级 |
| "调试时直接改代码" | 根因调查完成前不得修改源码 |
| "轻量验证可以跳过" | 5 项快速检查必须执行 |
| "文案修改不需要测试" | 即使文案变更也须定义验证用例 |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required |
|------|-----------|----------|
| 验证 | `verification-before-completion` | true |
| 分支处理 | `finishing-a-development-branch` | true |
| CI/CD | `ci-cd-and-automation` | true |
| 归档 | `documentation-and-adrs` | true |
| 调试（触发时） | `systematic-debugging` | false |
