# Design: introduce-grill-me-skill

> 层级: Level 0-2 设计文档 | 所属层: Design 阶段增强 | 版本: 0.14.0

---

## 1. 设计概览

### 1.1 目标

在 MumuSpec Design 阶段的认知框架收敛后、Hyperplan 对抗审查前，插入 grill-me 深度追问步骤，作为设计方案的"压力测试"环节。

### 1.2 架构总览

```
Cognitive Framework (Step 2)
  Q1 → Q2 → Q3 → Q4 → converged
        ↓
  grill-me pressure test (Step 2.5)  ← NEW
  - extract undecided branches
  - DFS traversal, one question per round
  - fact vs decision separation
  - explicit consensus gate
        ↓
  Hyperplan adversarial review (Step 4, conditional)
        ↓
  Test cases & build layers
```

---

## 2. Level 0 — 根层：grill-me 步骤定义

### 2.1 新增 Step 2.5 到 phase-design.md

在现有 Step 2（认知框架）和 Step 3（自顶向下设计）之间插入 Step 2.5。

**位置**：phase-design.md 的 Step 2 Stage 4 之后、Step 3 之前

**命名**："Step 2.5: grill-me 压力测试 — 设计方案共识验证"

**阻塞点**：BP-4.5（新增）

### 2.2 触发条件

```
IF cognitive_framework.converged == true
   AND workflow == "full"
   AND has_undesignated_decisions(cognitive-map.yaml)
THEN trigger grill_me_step
ELSE skip to Step 3
```

### 2.3 退出条件（任一满足即退出）

1. 用户显式确认"已达成共识"
2. 遍历完所有决策分支（无更多可追问的决策点）
3. 达到 10 轮上限

---

## 3. Level 1 — 模块层：执行协议

### 3.1 输入

| 输入来源 | 用途 |
|---------|------|
| cognitive-map.yaml Q1 锚定 | 作为追问的事实基础（high-confidence 条目不追问） |
| cognitive-map.yaml Q3 confirmed | 已确认约束跳过 |
| cognitive-map.yaml Q4 残留 | 每个盲区转化为 1-2 个追问 |
| design tree (从 cognitive-map 推导) | DFS 遍历顺序 |

### 3.2 执行流程

```
函数: executeGrillMe(cognitiveMap, designTree, maxRounds=10)
输出: updated cognitiveMap + consensusLog

1. branches = extractUndecidedBranches(cognitiveMap, designTree)
2. rounds = 0
3. consensus = false

4. WHILE rounds < maxRounds AND NOT consensus:
   a. currentBranch = DFS_next(branches)
   b. IF currentBranch == null: BREAK  // 无更多分支
   c. question = generateQuestion(currentBranch, cognitiveMap)
   d. options = generateOptions(currentBranch, cognitiveMap)  // 2-4 个
   e. recommended = deriveRecommendation(currentBranch)
   f. present(question, options, recommended)  ← 阻塞等待用户回答
   g. answer = getUserResponse()
   h. IF answer == "consensus": consensus = true; BREAK
   i. recordToCognitiveMap(answer, currentBranch)
   j. rounds++

5. set GrillMe.completed = true
6. set GrillMe.rounds = rounds
7. set GrillMe.consensusReached = consensus
8. set GrillMe.deferredCount = count(deferred items)
9. RETURN cognitiveMap + GrillMe record
```

### 3.3 问题生成规则

| 分支类型 | 问题模板 | 选项策略 |
|---------|---------|---------|
| 技术选型 | "基于 [Q1 引用]，推荐 [方案] 因为 [理由]。这是最佳选择吗？" | 2-3 个替代方案 + "其他" |
| 架构决策 | "设计选择 [方案 A]，因为 [权衡]。你同意吗？" | 同意 / 不同意（请说明） / 不确定 |
| 依赖假设 | "设计依赖 [X]，当前状态 [Y]。假设成立吗？" | 成立 / 不成立 / 需要验证 |
| 边界条件 | "[场景] 下推荐行为 [Z]。符合预期吗？" | 符合 / 不符合 / 边界需调整 |

### 3.4 事实自查规则（Fact vs Decision Separation）

**Agent 自查**（不问用户）：
- 框架/库版本 → 读 package.json
- API 签名 → 读代码
- Schema → 读 migration
- 已有约束 → 读 spec.md
- 目录结构 → 读文件系统

**询问用户**（不自查）：
- 业务优先级
- 兼容性需求
- 复杂度接受度
- 隐性设计意图

---

## 4. Level 2 — 组件层：边界处理

### 4.1 上限保护

当 rounds == maxRounds 时：
- 停止追问
- 将剩余分支标记为 "deferred-limit-reached"
- 设置 consensusReached = false（但非阻塞，仍可进入 Hyperplan）
- 在 decisions.md 记录强制收敛原因

### 4.2 用户退出权

用户可随时回答：
- "consensus" / "已共识" → 立即退出追问
- "skip this" → 当前分支标记 deferred，继续下一分支
- "go back" → 回退到上一问题修改答案

### 4.3 与认知框架的反馈循环

```
grill-me 发现深度冲突（用户拒绝核心设计）
  → cognitive-framework.rollback_count++
  → 触发认知框架增量轮（重新 Q2 提问）
  → 新 Q1 信息 = grill-me 中确认的约束

grill-me 发现轻度问题
  → 直接更新 cognitive-map.yaml Q3 条目
  → 继续推进到 Hyperplan
```

### 4.4 与 Hyperplan 的关系

| grill-me 产出 | Hyperplan 影响 |
|--------------|---------------|
| confirmed 决策 | 不再攻击已确认约束 |
| deferred 项 | 作为 Hyperplan 重点攻击目标 |
| consensus=true | Hyperplan 正常执行 |
| consensus=false | Hyperplan 增加"grill-me 遗留"审查维度 |

---

## 5. cognitive-map.yaml Schema 扩展

```yaml
# 追加到现有 cognitive-map.yaml
grill_me:
  completed: false           # 是否完成
  rounds: 0                  # 实际追问轮次
  max_rounds: 10             # 上限
  deferred_count: 0          # 未解决问题数
  consensus_reached: false   # 是否达成共识
  entries:
    - id: "GM-001"
      round: 1
      branch: "tech-choice:api-style"
      question: "推荐 RESTful 而非 GraphQL 因为..."
      options: ["RESTful", "GraphQL", "混合"]
      recommended: "RESTful"
      answer: "RESTful"
      status: "confirmed"     # confirmed | rejected | deferred
      q1_refs: ["Q1-003", "Q1-007"]
      timestamp: "2026-08-01T01:00:00Z"
```

---

## 6. .mumuspec.yaml Schema 扩展

```yaml
# 追加到 cognitive_framework 同层级
grill_me_result:
  completed: false
  rounds: 0
  consensus_reached: false
  deferred_count: 0
```

---

## 7. Phase Guard 扩展

`design_to_build` 守卫追加检查项：

```yaml
- grill_me_result.completed: true
- grill_me_result.rounds <= 10
- cognitive_map.grill_me.deferred_count == 0 OR
  cognitive_map.grill_me.deferred_documented: true
```

**向后兼容**：旧变更无 `grill_me_result` 字段时，guard 检查跳过（因在 v0.14.0 前无此检查项）。

---

## 8. 关键 SHALL / SHALL NOT

### SHALL

| ID | 约束 |
|----|------|
| S-001 | grill-me 步骤 SHALL 在认知框架 converged 后执行 |
| S-002 | grill-me 每次只问 1 个问题，等用户回答后再继续 |
| S-003 | 每个问题 SHALL 附带 2-4 个选项 + Agent 推荐 + 理由 |
| S-004 | Agent 可自查的事实 SHALL NOT 询问用户 |
| S-005 | 上限 10 轮强制退出 |
| S-006 | 用户 SHALL 能随时退出追问 |
| S-007 | grill-me 产出 SHALL 写入 cognitive-map.yaml |
| S-008 | Phase Guard SHALL 检查 grill_me_result.completed |

### SHALL NOT

| ID | 约束 |
|----|------|
| SN-001 | grill-me SHALL NOT 替代认知框架 Q1-Q4 |
| SN-002 | grill-me SHALL NOT 替代 Hyperplan |
| SN-003 | grill-me SHALL NOT 在 hotfix/tweak 中执行 |
| SN-004 | grill-me SHALL NOT 超 10 轮仍不退出 |
| SN-005 | grill-me SHALL NOT 修改 spec.md 或 prohibitions.md |

---

## 9. 设计理由（Ponytail）

| 决策 | 理由 |
|------|------|
| 每次一问而非批量 | grill-me 核心机制，深度 > 广度 |
| 事实与决策分离 | 减少用户负担，尊重用户时间 |
| 10 轮上限 | 平衡深度与效率，避免疲劳 |
| 独立确认+整体门禁双层 | 单个决策准确 + 全局共识 |
| 不回退到 Open 阶段 | grill-me 问题是设计方案内部验证，不涉及需求层 |
| 不新增 CLI 命令 | ponytail: 最小侵入 |

---

## 10. Q4 盲区缓解

| 盲区 | 缓解措施 |
|------|---------|
| 旧变更无 grill_me 字段 | Phase Guard 向后兼容（默认跳过） |
| 用户在第 10 轮仍有大量未决 | 强制记录为 deferred，进入 Hyperplan 暴露 |
| 事实自查不准确 | 高置信度事实才跳过，否则标注"Agent 验证待确认" |
| 多轮追问上下文溢出 | cognitive-map.yaml 持久化，上下文恢复时继续 |

---

> **导航**: [← Proposal](./proposal.md) | [Delta Specs](./delta-specs/) | [决策记录](./decisions.md) | [Cognitive Map](./cognitive-map.yaml)
