---
id: "KP-0052"
title: "MumuSpec Phase 2: Design（技术设计 — 自顶向下）"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/skills/mumuspec-design.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# MumuSpec Phase 2: Design（技术设计 — 自顶向下）

> **Source**: `docs/reference/skills/mumuspec-design.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

**前置条件**：活跃变更存在，proposal.md + delta-specs/ 已创建

## Original Content

---
name: mumuspec-design
description: "MumuSpec Phase 2: Design。以 /mumuspec-design 启动。认知框架 Q1-Q4 + 自顶向下逐层设计 + Hyperplan 对抗审查 + 测试用例锁定。"
phase: design
workflow: full
---

# MumuSpec Phase 2: Design（技术设计 — 自顶向下）

## 快速决策（Decision Core）

**前置条件**：活跃变更存在，proposal.md + delta-specs/ 已创建

**阻塞点**：
- BP-4: 设计方案确认
- BP-5: 认知框架 Q2 回答
- BP-6: 认知框架 Q3 确认
- BP-7: Hyperplan 开放问题解决
- BP-8: 测试用例锁定确认

**退出条件**：design.md + cognitive-map.yaml + test-cases/（已锁定）+ build_layers 创建完成，用户已确认，Phase Guard 通过

**设计原则**：自顶向下（Level 0 → Level N 逐层细化），测试用例作为设计的一部分在各层同步定义。

---

## 前置条件

- 活跃变更存在（proposal.md, delta-specs/, impact-analysis.json）
- `.mumuspec.yaml` 的 `phase` 为 `open`（将通过 guard 转换为 `design`）
- 无 design.md（尚未进入 Design 阶段）

---

## 执行步骤

### Step 0: 输出语言约束

设计文档和认知地图必须使用触发本工作流的用户请求的语言。

**幂等性**：可安全重复执行。

### Step 1: 入口状态验证

```bash
mumuspec state check <name> design
```

验证通过后进入 Step 2。脚本在验证失败时输出具体失败原因。

**幂等性**：所有 Design 阶段操作可安全重执行。若 `cognitive-map.yaml` 已存在，确认其与当前工件匹配后决定是否重新执行。

### Step 2: 认知框架启动（步骤 0）— MumuSpec 独有

Design 阶段首先启动基于乔哈里窗变体的认知框架，系统化地梳理已知信息和未知盲区。

> **详细规范见 [参考：认知框架](../cognitive-framework.md)**

#### Stage 1: 信息采集 — Q1 锚定

**立即执行**：使用 Skill 工具加载 `gitnexus-exploring` skill。

读取以下信息源并产出 Q1 锚定声明：

| 来源 | 内容 |
|------|------|
| `proposal.md` | 变更目标、影响范围、delta-specs |
| 既有 `spec.md` | 当前层级的 SHALL/SHALL NOT 约束（渐进式披露加载） |
| `code-graph/impact-analysis.json` | 影响分析结果 |
| 既有 `design.md` | 现有架构决策和技术选型 |
| 既有 `contracts/` | 外部服务契约 + 对外契约 |
| Knowledge Layer | Open 阶段加载的历史知识 |

**产出**：Q1 锚定声明，每条标注置信度（high/medium/low），执行矛盾检测。

#### Stage 2: 探索激活 — Q2 提问 — BLOCKING POINT (BP-5)

**立即执行**：使用 Skill 工具加载 `brainstorming` skill。

从 Q1 识别信息缺口 → 生成 Q2 提问（含 2-4 个选项）→ 用户回答 → 回答迁移到 Q1。

**关键约束**：
- 每个 Q2 提问必须附带 2-4 个选项（含"不确定"选项）
- 选项必须引用 Q1 中的上下文
- 单轮最多 5 个 Q2 问题
- 用户回答后信息从 Q2 迁移到 Q1
- 循环直到 Q2 收敛或达到轮次上限

**必须使用平台用户输入/确认机制暂停等待用户回答每个 Q2 问题。**

#### Stage 3: 盲区扫描 — Q3 推理 + Q4 扫描 — BLOCKING POINT (BP-6)

**Q3 推理链**（每轮 ≤ 3 条）：
- 基于 Q1 推导隐性需求/约束
- 格式：`Q1[编号] + Q1[编号] → Q3: 推导结论`
- 用户确认（confirmed/rejected/modified）— **必须暂停等待用户确认**

**Q4 盲区扫描**（至少扫描 3 个维度）：

| 扫描维度 | 检查方法 |
|---------|---------|
| 隐藏耦合 | `mumuspec trace <symbol>` 深度遍历 |
| 并发安全 | 代码图谱 CONSUMES 边 + 模式匹配 |
| 契约兼容性 | `mumuspec contract compat-check` |
| 规范继承冲突 | 规范加载时可满足性检查 |
| 依赖链风险 | 依赖版本扫描 |
| 合规盲区 | 安全扫描 Skill |
| 性能盲区 | 代码图谱 CALLS 边分析 |
| 测试盲区 | 边界条件、异常路径分析 |

**Q3 confirmed 的约束自动转化为 design.md 中的 SHALL/SHALL NOT 草案。Q4 残留项写入兜底策略。**

#### Stage 4: 设计生成

基于完整 Q1 生成 design.md 草案 + Q4 兜底写入风险章节 + cognitive-map.yaml 快照。

**收敛规则**：Stage 2+3 合计不超过 5 轮。达到上限后强制收敛，未解决问题标记为 `unresolved`。

### Step 3: 自顶向下逐层设计

基于认知框架的 Q1 锚定声明和 Q3 确认约束，进行自顶向下逐层设计：

1. **Level 0 根层** → **Level 1 模块层** → **Level 2 组件层** → **Level 3+ 叶子层**
2. 每层定义 SHALL/SHALL NOT 和测试用例
3. Q3 confirmed 的约束自动转化为对应层的 SHALL/SHALL NOT
4. 代码图谱验证（确认不破坏现有调用链）

**领域 Skill 提示**：
- 涉及 API 层 → 考虑 `api-and-interface-design`
- 涉及安全 → 考虑 `security-and-hardening`
- 涉及性能 → 考虑 `performance-optimization`

### Step 4: Hyperplan 对抗式审查 — BLOCKING POINT (BP-7)

> **触发条件**（满足任一即触发）：
> - `affected_scopes.length >= 3`
> - `delta-specs` 引入新的 SHALL NOT
> - `workflow == "full"`

> **跳过条件**：不满足触发条件（hotfix/tweak 已跳过 Design）。

**立即执行**：通过 `subagent-driven-development` 创建 5 成员对抗团队。

5 个对抗角色交叉攻击设计方案，产出 4 类幸存洞察：

| 洞察类型 | MumuSpec 衔接动作 |
|---------|------------------|
| `hard_constraints` | 合并到 design.md 的 SHALL/SHALL NOT |
| `decisions` | 记录到 design.md 决策章节 + decisions.md |
| `risks` | 记录到 design.md 风险章节；test-cases/ 须有对应验证用例 |
| `open_questions` | 用户输入门禁，阻断 test-cases/ 编写 — **BP-7** |

**反馈循环**：若存在 unresolved risks 或 open_questions：
- hyperplan `risks` → 触发认知框架增量轮次，作为新 Q4 扫描维度
- hyperplan `open_questions` → 转化为新 Q2 问题，进入认知框架 Stage 2 增量轮
- 更新 `cognitive-map.yaml` 后继续

### Step 5: 编写测试用例规格

基于 Q1 锚定 + Q3 确认约束 + Hyperplan 幸存硬约束设计测试用例：

- 按 layer 组织：`test-cases/layer-0-cases.md`, `layer-1-cases.md`, ...
- Q4 兜底策略中的测试兜底项须有对应测试用例
- Hyperplan `risks` 须有对应测试用例验证缓解措施

### Step 6: 生成实现层级计划

生成 `build_layers`（从深到浅排序）：
```yaml
build_layers:
  - layer: 3
    status: pending
  - layer: 2
    status: pending
  - layer: 1
    status: pending
  - layer: 0
    status: pending
```

### Step 7: 锁定测试用例 — BLOCKING POINT (BP-8)

计算 test-cases/ 的 hash，设置 `test_cases.design_locked = true`：

```bash
mumuspec test-cases lock --change <name>
```

**必须使用平台用户输入/确认机制暂停等待用户确认锁定。**

锁定后：
- `test_cases.design_locked: true`
- `test_cases.design_content_hash: <sha256>`
- **测试用例不可变更**。需修改必须回退到 Design。

### Step 8: 追加 decisions.md Design 章节

记录认知框架决策 + Hyperplan 幸存洞察 + 设计选择：

```bash
mumuspec decisions append --phase design --change <name>
```

记录内容：
- 分层设计选择
- SHALL/SHALL NOT 理由
- 认知框架决策（Q2 回答/Q3 确认/Q4 兜底）
- Hyperplan 幸存洞察
- test-cases 依据
- 接口契约决策

### Step 9: 用户确认 — BLOCKING POINT (BP-4)

**必须使用当前平台可用的用户输入/确认机制暂停等待用户确认设计方案。**

展示摘要：
- 认知框架：Q1 条目数、Q2 解决数、Q3 确认数、Q4 残留数
- 设计方案：层级结构、关键 SHALL/SHALL NOT
- Hyperplan：幸存洞察数（若触发）
- 测试用例：层数、用例数
- 风险：Q4 残留 + Hyperplan 风险

---

## 退出条件

- design.md 存在且内容完整
- cognitive-map.yaml 存在且已收敛
- constraints/new-shall.md 或 new-shall-not.md 存在
- 所有 Enforcement 检查已定义（非 TBD）
- code-graph 验证无破坏性调用链
- build_layers 定义
- design_layers_covered: [0,1,2,3]
- test-cases/ 存在，每层至少一个 cases.md
- `test_cases.design_locked: true`
- `test_cases.design_content_hash` 匹配
- `tdd_mode == "tdd"`
- Hyperplan 硬约束已合并、开放问题已解决（若触发）
- 认知框架：Q1 > 0、Q2/Q3 无待处理（或达上限）、Q4 扫描 ≥ 3 维度、已收敛
- `ponytail_constraints_defined: true`
- **用户已确认** (BP-4)
- **Phase Guard**：运行 `mumuspec guard <name> design --apply`

---

## Phase Guard 调用

```bash
mumuspec guard <change-name> design --apply
```

Guard 检查项（`design_to_build`）：
- design.md exists and non-empty
- constraints/ exists
- all enforcement checks defined
- code-graph verified no broken call chains
- build_layers defined
- design_layers_covered
- each_layer_shall_defined: true
- test-cases/ exists with cases.md per layer
- test_cases.design_locked: true
- test_cases.design_content_hash matches
- tdd_mode == "tdd"
- hyperplan_result.hard_constraints merged（若触发）
- hyperplan_result.open_questions resolved（若触发）
- cognitive_framework.enabled: true
- cognitive_framework.cognitive_map_ref exists
- cognitive_framework.q1_count > 0
- cognitive_framework.q2_pending == 0 or rounds >= 5
- cognitive_framework.q3_pending == 0 or rounds >= 5
- cognitive_framework.q4_scans_completed >= 3
- cognitive_framework.converged: true
- ponytail_constraints_defined: true
- decisions_log.counts.design > 0
- decisions_log.content_hash matches
- user_confirmed: true

---

## 自动流转到下一阶段

```bash
mumuspec state next <change-name>
```

- `NEXT: auto` → 调用 `/mumuspec-build`
- `NEXT: manual` → 提示用户手动运行 `/mumuspec-build`

---

## 上下文压缩恢复

```bash
mumuspec state check <change-name> design --recover
```

恢复时优先读取：
- `cognitive-map.yaml`（认知框架当前状态）
- `design.md`（已有设计草案）
- `decisions.md` Design 章节

若认知框架未收敛，从 Stage 2/3 继续。若已收敛但 design.md 未完成，从 Step 3 继续。

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "Q1 信息够了，跳过 Q2" | Q2 提问不可跳过 — 必须检查信息缺口 |
| "Q2 用开放性问题就行" | Q2 必须附带选项 — 不可是开放性问题 |
| "Q3 可以基于 Q2 推导" | Q3 只能基于 Q1 — 未回答的问题不能作推导前提 |
| "Q4 扫描太耗时，跳过" | Q4 不可跳过 — 至少扫描 3 个维度 |
| "Hyperplan 可以跳过 Round 2/3" | 跳过 Round 2/3 导致守卫失败 |
| "测试用例可以 Build 阶段再写" | 测试用例是设计的一部分 — Design 阶段锁定 |
| "用户没确认 Q3，先继续" | Q3 必须 confirmed/rejected/modified — 不可跳过 |
| "认知框架 5 轮太多了，提前收敛" | 强制收敛仅在达到 5 轮上限后触发 |
| "Ponytail 约束不需要检查" | ponytail_constraints_defined 是守卫必检项 |
| "design.md 可以不写 Enforcement" | 所有 Enforcement 检查必须定义（非 TBD） |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required | 阶段 |
|------|-----------|----------|------|
| Q1 信息采集 | `gitnexus-exploring` | true | Stage 1 |
| Q2 提问 + Q3 推理 | `brainstorming` | true | Stage 2-3 |
| Q4 安全盲区 | `security-and-hardening` | false | Stage 3 |
| Q4 性能盲区 | `performance-optimization` | false | Stage 3 |
| Q4 疑虑驱动 | `doubt-driven-development` | false | Stage 3 |
| 对抗审查 | `hyperplan` | conditional | Step 4 |
| 接口设计 | `api-and-interface-design` | false | Step 3 |
| 决策记录 | `documentation-and-adrs` | true | Step 8 |

