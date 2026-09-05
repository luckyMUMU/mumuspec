---
name: phase-design
description: "MumuSpec Phase 2: Design。以 /phase-design 启动。认知框架 Q1-Q4 + grill-me 深度追问 + 自顶向下逐层设计 + Hyperplan 对抗审查 + 测试用例锁定。"
---

# Phase: Design — 技术设计（自顶向下）

> **阶段**: 2 · **workflow**: full

## 快速决策（Decision Core）

**前置条件**：活跃变更存在，proposal.md + delta-specs/ 已创建

**阻塞点**：
- BP-4: 设计方案确认
- BP-4.5: grill-me 共识确认
- BP-5: 认知框架 Q2 回答
- BP-6: 认知框架 Q3 确认
- BP-7: Hyperplan 开放问题解决
- BP-8: 测试用例锁定确认

**退出条件**：design.md + cognitive-map.yaml + test-cases/（已锁定）+ grill-me 共识记录 + build_layers 创建完成，用户已确认，Phase Guard 通过

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

### Step 2: 认知框架启动（乔哈里窗变体）— MumuSpec 独有

> **详细规范**：模板见 `.mumuspec/templates/cognitive-map-template.yaml`，格式规范见 `.mumuspec/templates/cognitive-map-schema.md`
>
> **初始化**：运行 `mumuspec cognitive-map init <name>` 从模板生成变更的 cognitive-map.yaml（--force 覆盖）；条目内容由 Agent 撰写（Q1-Q4 推理属决策域），写完后运行 `mumuspec cognitive-map sync <name>` 重算 `.mumuspec.yaml` 的 cognitive_framework 计数

#### ⚠️ cognitive-map.yaml 格式注意

Guard 校验的是 `.mumuspec.yaml` 中的 `cognitive_framework` 字段，而非直接解析 `cognitive-map.yaml` 文件。

**Guard 接受的唯一格式：**

```yaml
entries:
  - quadrant: Q1|Q2|Q3|Q4
    category: known-known|known-unknown|reasoning|blind-spot|persistent
    question: "问题描述"
    answer: "答案"
    confidence: high|medium|low
    source: "信息来源"
    # Q2 附加字段：options: ["A", "B"]
    # Q3 附加字段：status: confirmed|rejected|modified
```

**常见 guard 错误与修复：**

| 错误 | 根因 | 修复 |
|------|------|------|
| `E-DESIGN-001 cognitive-map.yaml 不存在` | `.mumuspec.yaml` 中 `cognitive_framework.q1_count == 0` | 在 `.mumuspec.yaml` 中更新 `q1_count` 为实际条目数 |
| `E-DESIGN-002 Q1 已知的已知为空` | 同上 | 确保 `q1_count > 0` |
| `E-DESIGN-005 Q4 扫描仅 0 个维度` | `q4_scans_completed < 3` | 至少添加 3 个 Q4 blind-spot entries，设置 `q4_scans_completed >= 3` |
| `E-DESIGN-006 认知地图未收敛` | `converged: false` | 设置 `converged: true` 且 `q2_pending = 0` |

#### Required Skill 降级策略

| Skill | 不可用时的替代方案 |
|-------|------------------|
| `gitnexus-exploring` | 使用 `grep`/`find` + 代码阅读手动收集信息（子集 Fallback B） |
| `brainstorming` | 使用平台 AskQuestion 工具手动追问（同 phase-open Fallback A） |
| `grill-me` | 使用 AskQuestion 工具对每个设计决策点进行单问题追问（见下方 Fallback E） |
| `hyperplan` | 使用单 Agent 多角度自我审查替代（见下方 Fallback F） |
| `subagent-driven-development` | 无需创建对抗团队，直接执行 self-review |

#### Fallback E：grill-me 手动追问协议

```
1. 从 cognitive-map.yaml 识别未决策的设计分支
2. 对每个分支使用 AskQuestion 提问：
   - 问题格式："基于 [Q1 引用]，推荐 [方案] 因为 [理由]。是否同意？"
   - 提供 2-3 个选项
   - 等待用户回答
3. 用户回答后更新 cognitive-map.yaml（Q3 entry）
4. 上限 10 轮，达到上限后剩余分支标记为 "deferred-limit-reached"
```

#### Fallback F：hyperplan 自我审查协议

当无法创建 5 成员对抗团队时，从 5 个角度进行自我审查：

| 角色 | 审查角度 | 产出类型 |
|------|---------|---------|
| 架构师 | 层间依赖、调用链完整性 | hard_constraints |
| 安全工程师 | 输入验证、XSS、注入风险 | risks |
| 性能工程师 | 内存、响应时间、并发瓶颈 | risks |
| 可维护性工程师 | API 稳定性、向后兼容 | decisions |
| 测试工程师 | 边界条件、异常路径 | open_questions |

每个角色独立审查 design.md，发现问题写入 `hard_constraints`、`risks`、`decisions` 或 `open_questions`。

---

#### Stage 1: 信息采集 — Q1 锚定

**立即执行**：使用 Skill 工具加载 `gitnexus-exploring` skill。

> **降级说明**：若 `gitnexus-exploring` 不可用，手动读取 `proposal.md`、`impact-analysis.md`、既有 `spec.md` 和 `design.md` 收集 Q1 锚定信息。

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

### Step 2.5: grill-me 压力测试 — 设计方案共识验证 — BLOCKING POINT (BP-4.5)

> **grill-me 来源**：适配 mattpocock/skills 的 grill-me 模式（决策树 DFS 追问）

> **降级说明**：若 `grill-me` skill 不可用，按 **Fallback E** 使用 AskQuestion 工具手动执行追问。

#### 触发条件

```
cognitive_framework.converged == true
AND workflow == "full"
AND has_undesignated_decisions(cognitive-map.yaml)
```

#### 执行协议

```
首选载体: mumuspec grill-me run --phase design --change <name>
  （结果自动写回 .mumuspec.yaml 的 grill_me_result；交互模式 --interactive）
输入: cognitive-map.yaml (Q1 锚定 + Q3 确认约束 + Q4 残留)
输出: grill-me 共识记录 + cognitive-map.yaml 更新

1. 从 cognitive-map.yaml 提取未决策的设计分支
2. 按 DFS 顺序遍历决策树:
   a. 每个决策点: 检查是否已有 Q3 confirmed 约束覆盖
   b. 若已覆盖 → skip
   c. 若未覆盖 → 生成问题 + 推荐答案 + 事实依据
3. 提问规则:
   - 每次只提 1 个问题
   - 附带 2-4 个选项（含 Agent 推荐标记）
   - 等待用户回答
4. 回答处理:
   - confirmed → 写入 cognitive-map.yaml 作为新 Q3 条目
   - rejected + 替代方案 → 写入 cognitive-map.yaml 作为新 Q3 条目
   - skip/maybe → 标记为 "deferred"，写入 Q4 残留
5. 退出条件（任一满足即退出）:
   - 用户显式确认"已达成共识"
   - 遍历完所有决策分支
   - 达到 10 轮上限
6. 设置 cognitive-map.yaml 中 grill_me.completed: true
```

#### 问题生成规则

| 分支类型 | 问题模板 |
|---------|--------|
| 技术选型 | "基于 [Q1 引用]，推荐 [方案] 因为 [理由]。这是最佳选择吗？" |
| 架构决策 | "设计选择 [方案 A]，因为 [权衡]。你同意吗？" |
| 依赖假设 | "设计依赖 [X]，当前状态 [Y]。假设成立吗？" |
| 边界条件 | "[场景] 下推荐行为 [Z]。符合预期吗？" |

#### 事实与决策分离

**Agent 自查**（不问用户）：框架版本、API 签名、Schema、已有约束、目录结构

**询问用户**（不自查）：业务优先级、兼容性需求、复杂度接受度、隐性设计意图

#### 上限保护

当达到 10 轮上限时：停止追问，剩余分支标记为 `deferred-limit-reached`，设置 `consensus_reached = false`（仍可进入 Hyperplan，但增加"遗留问题"审查维度）。

#### 反馈循环

grill-me 发现深度冲突（用户拒绝核心设计）→ 触发认知框架增量轮，grill-me 确认的约束作为新 Q1 信息。

#### 产出

- cognitive-map.yaml 更新（追加 grill_me 条目）
- decisions.md 追加 grill-me 章节
- `.mumuspec.yaml` 的 `grill_me_result` 字段更新

cognitive-map.yaml grill-me 条目格式（追加到 entries 列表中）：
```yaml
- quadrant: Q3
  category: reasoning
  status: confirmed
  question: "GM-001: <决策问题>"
  answer: "用户回答"
  confidence: high
  source: "grill-me"
  options: ["选项 A", "选项 B"]    # Q2/grill-me 专用
```
  entries:
    - id: "GM-001"
      round: 1
      branch: "tech-choice:api-style"
      question: "..."
      options: ["..."]
      recommended: "..."
      answer: "..."
      status: "confirmed"    # confirmed | rejected | deferred
      q1_refs: ["Q1-001"]
      timestamp: "..."
```

---

### Step 3: 自顶向下逐层设计

基于认知框架的 Q1 锚定声明、Q3 确认约束和 grill-me 共识记录，进行自顶向下逐层设计：

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

> **降级说明**：若 `subagent-driven-development` 或 `hyperplan` skill 不可用，按 **Fallback F** 使用单 Agent 多角度自我审查替代。

5 个对抗角色交叉攻击设计方案，产出 4 类幸存洞察：

| 洞察类型 | MumuSpec 衔接动作 |
|---------|------------------|
| `hard_constraints` | 合并到 design.md 的 SHALL/SHALL NOT |
| `decisions` | 记录到 design.md 决策章节 + decisions.md |
| `risks` | 记录到 design.md 风险章节；test-cases/ 须有对应验证用例 |
| `open_questions` | **用户输入门禁，阻断 test-cases/ 编写 — BP-7** |

**反馈循环**：若存在 unresolved risks 或 open_questions：
- hyperplan `risks` → 触发认知框架增量轮次，作为新 Q4 扫描维度
- hyperplan `open_questions` → 转化为新 Q2 问题，进入认知框架 Stage 2 增量轮
- 更新 `cognitive-map.yaml` 后继续

### Step 5: 编写测试用例定义

基于 Q1 锚定 + Q3 确认约束 + grill-me 共识记录 + Hyperplan 幸存硬约束设计测试用例：

- 按 layer 组织：`test-cases/layer-0-cases.md`, `layer-1-cases.md`, ...
- 骨架生成：`mumuspec test-cases init <name> --layers 3,2,1,0`（按 build_layers 深度优先序）
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

记录认知框架决策 + grill-me 共识记录 + Hyperplan 幸存洞察 + 设计选择：

```bash
mumuspec decisions append --phase design --change <name> --text "<本组决策要点（单行摘要）>"
```

记录内容：
- 分层设计选择
- SHALL/SHALL NOT 理由
- 认知框架决策（Q2 回答/Q3 确认/Q4 兜底）
- grill-me 共识记录
- Hyperplan 幸存洞察
- test-cases 依据
- 接口契约决策

### Step 9: 用户确认 — BLOCKING POINT (BP-4)

**必须使用平台用户输入/确认机制暂停等待用户确认设计方案。**

展示摘要：
- 认知框架：Q1 条目数、Q2 解决数、Q3 确认数、Q4 残留数
- grill-me：追问轮次、共识状态、deferred 项
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
- `tdd_mode` 匹配配置值 (default_tdd_mode)
- Hyperplan 硬约束已合并、开放问题已解决（若触发）
- grill-me：`grill_me_result.completed == true`、`rounds <= 10`
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
- tdd_mode matches default_tdd_mode
- hyperplan_result.hard_constraints merged（若触发）
- hyperplan_result.open_questions resolved（若触发）
- cognitive_framework.enabled: true
- cognitive_framework.cognitive_map_ref exists
- cognitive_framework.q1_count > 0
- cognitive_framework.q2_pending == 0 or rounds >= 5
- cognitive_framework.q3_pending == 0 or rounds >= 5
- cognitive_framework.q4_scans_completed >= 3
- cognitive_framework.converged: true
- grill_me_result.completed: true
- grill_me_result.rounds <= 10
- ponytail_constraints_defined: true
- decisions_log.counts.design > 0
- decisions_log.content_hash matches
- user_confirmed: true

---

## 自动流转到下一阶段

```bash
mumuspec state next <change-name>
```

- `NEXT: auto` → 调用 `phase-build`
- `NEXT: manual` → 提示用户手动运行 `phase-build`

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
| "grill-me 可以跳过，直接进入 Hyperplan" | BP-4.5 不可跳过（full 工作流），共识确认是必要步骤 |
| "grill-me 让用户填问卷（批量提问）" | 每次只问 1 个问题，等回答后再继续 |
| "grill-me 问纯技术事实" | 事实与决策分离 — 代码可查的信息不问用户 |
| "Hyperplan 可以跳过 Round 2/3" | 跳过 Round 2/3 导致阶段守卫失败 |
| "测试用例可以 Build 阶段再写" | 测试用例是设计的一部分 — Design 阶段锁定 |
| "用户没确认 Q3，先继续" | Q3 必须 confirmed/rejected/modified — 不可跳过 |
| "认知框架 5 轮太多了，提前收敛" | 强制收敛仅在达到 5 轮上限后触发 |
| "Ponytail 约束不需要检查" | ponytail_constraints_defined 是阶段守卫必检项 |
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
| 深度追问共识 | `grill-me` | true | Step 2.5 |
| 对抗审查 | `hyperplan` | conditional | Step 4 |
| 接口设计 | `api-and-interface-design` | false | Step 3 |
| 决策记录 | `documentation-and-adrs` | true | Step 8 |
