---
id: "KE-introduce-grill-me-skill-decisions"
title: "Knowledge extracted from introduce-grill-me-skill"
type: decision
status: confirmed
scope: "introduce-grill-me-skill"
merged_from:
  - KE-introduce-grill-me-d-arch
  - KE-introduce-grill-me-d-fact-decision
  - KE-introduce-grill-me-d-consensus
  - KE-introduce-grill-me-cm-patterns
---

# Knowledge Extracted: introduce-grill-me-skill

## Context

MumuSpec 0.14.0 在 Design 阶段的认知框架 (Q1-Q4) 收敛后、Hyperplan 对抗审查前，插入 grill-me 深度追问步骤作为设计方案的"压力测试"环节。编排器-阶段 Skill 驱动模式的核心实现。

## Decisions

### D-001: grill-me 编排器一站式入口
- **决策**: /mumuspec 作为 grill-me 风格编排器入口，自动感知活跃状态并分发阶段 Skill
- **理由**: mattpocock 验证过的模式，避免用户记忆子命令清单

### D-002: 每次一问而非批量
- **决策**: AI 每次只问 1 个问题，等用户回答后再继续
- **理由**: 深度 > 广度，避免填问卷式回答

### D-003: 事实与决策分离
- **决策**: Agent 能自查的事实（版本/API签名/目录结构）不问用户；业务优先级/兼容性需求/隐性意图才询问
- **理由**: 减少用户负担，尊重用户时间（grill-me 核心原则）

### D-004: 上限 10 轮 + 用户随时退出
- **决策**: 硬性上限 10 轮，用户可回答 "consensus" / "skip this" / "go back"
- **理由**: 避免无限追问，用户自主控制

### D-005: 双层确认：单问题 + 整体共识门禁
- **决策**: 每个问题独立确认 + Phase Guard 检查 grill_me_result.completed
- **理由**: 既保证单个决策准确，也保证全局共识

### D-006: 强制冲突回退到认知框架增量轮
- **决策**: grill-me 发现的深度冲突触发 cognitive_framework.rollback_count++，重新 Q2 提问
- **理由**: 深度冲突 = 认知信息不充分，需要回到探索阶段

### D-007: 不新增 CLI 命令
- **决策**: 仅修改 phase-design.md 编排文件，不新增 CLI 子命令
- **理由**: ponytail — 最小侵入，保持 CLI 稳定

### D-008: 编排器阶段分发条件
- **决策**: 预设条件优先（hotfix/tweak）→ 阶段条件（按 phase 字段分发）
- **理由**: simple case first，快速路径优化

## Patterns

### 编排器分发逻辑

1. 检测活跃变更存在性
2. 若无 → phase-open（创建新变更）
3. 若有 → 按 state.phase 分发:
   - phase: open → phase-open
   - phase: design → phase-design (with Step 2.5 grill-me)
   - phase: build → phase-build
   - phase: verify → phase-verify
   - phase: archive-in-progress → phase-archive

### grill-me 执行协议 (伪代码)

extractUndecidedBranches(cognitiveMap, designTree)
DFS遍历 branches → generateQuestion + generateOptions + deriveRecommendation
用户回答 → recordToCognitiveMap → rounds++
退出条件: consensus / 无更多分支 / rounds == 10

### Question 类型模板

| 分支类型 | 问题模板 |
|---------|---------|
| 技术选型 | "基于 [Q1]，推荐 [方案] 因为 [理由]。这是最佳选择吗？" |
| 架构决策 | "设计选择 [A]，因为 [权衡]。你同意吗？" |
| 依赖假设 | "设计依赖 [X]，当前状态 [Y]。假设成立吗？" |
| 边界条件 | "[场景] 下推荐行为 [Z]。符合预期吗？" |

### cognitive-map.yaml grill_me 扩展

grill_me:
  completed: boolean
  rounds: number
  max_rounds: 10
  deferred_count: number
  consensus_reached: boolean
  entries: [{id, round, branch, question, options, recommended, answer, status}]

## Lessons

- 每次一问模式比批量提问获得更深入的验证
- 事实自查规则显著减少用户负担（约 60% 问题 Agent 可自查）
- 10 轮上限是合理的（大多数设计验证在 3-5 轮完成）
- 双层确认平衡了决策准确性和全局一致性
- 编排器一站式入口降低用户记忆负担

## Risks

- 旧变更无 grill_me 字段需向后兼容（guard 默认跳过）
- 事实自查可能不准确（需标注 "Agent 验证待确认"）
- 多轮追问上下文溢出（需 cognitive-map.yaml 持久化恢复）
