---
id: "KE-enhance-design-phase-qa-summary"
title: "Knowledge extracted from enhance-design-phase"
type: decision
status: confirmed
scope: "enhance-design-phase"
merged_from:
  - KE-enhance-design-phase-0244dc62
  - KE-enhance-design-phase-41b18eaa
  - KE-enhance-design-phase-hyperplan
  - KE-enhance-design-phase-patterns
  - KE-enhance-design-phase-lessons
  - KE-enhance-design-phase-q3-2366adac
  - KE-enhance-design-phase-q3-f11dbe12
  - KE-enhance-design-phase-q4-risk
---

# Knowledge Extracted: enhance-design-phase

## Decisions

### Q1: 当前设计阶段最大的痛点是什么?
模板自由导致质量参差，无澄清循环，无质量检查，无一致性校验

### Q2: 设计阶段在 SDD 中的核心作用是什么?
将需求意图转化为可执行的技术规范，消除 AI 隐性假设，确保实现不漂移

### DEC-001: 模板强制字段分级策略
**Decision**: required_for 分三级：[full]、[full, tweak]、[full, hotfix, tweak]
**Rationale**: tweak 变更是小改动，不需要完整模板；full 需要严格约束
**Status**: confirmed
**Date**: 2026-08-01

### DEC-002: clarify 命令定位为可选增强
**Decision**: clarify 不阻塞设计流程，仅作为辅助工具
**Rationale**: 强制澄清会增加新手门槛；应让 AI 自主判断是否需要
**Status**: confirmed
**Date**: 2026-08-01

### DEC-003: AI 自审结果分级处理
**Decision**: CRITICAL 阻塞 + MAJOR 警告 + MINOR 提示
**Rationale**: 避免"警告疲劳"，确保关键问题必解决
**Status**: confirmed
**Date**: 2026-08-01

### DEC-004: 一致性检查放在 guard 中
**Decision**: 而非独立命令，随每次 guard 自动执行
**Rationale**: 集成度高，不会忘记运行
**Status**: confirmed
**Date**: 2026-08-01

### DEC-005: 任务粒度仅警告不阻塞
**Decision**: W-DESIGN-001 为 warning，不阻塞 verify
**Rationale**: 粒度判断主观性强，阻塞会引起效率下降
**Status**: proposed
**Date**: 2026-08-01

## Rationales

### Q1: 澄清循环为何独立成命令而非设计阶段内置?
保持阶段内聚性；clarify 是可选增强，不是强制流程

### Q2: 为什么不直接复制 GitHub Spec Kit 的模板?
Spec Kit 面向通用场景，MumuSpec 已有自己的 YAML 状态体系和 CLI，需整合而非照搬

## Patterns

### API Contracts

#### New CLI Commands

**`mumuspec clarify <change-name> [--max-questions N]`**
| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --max-questions | integer | 最大澄清问题数，默认 5 |

Output: Creates `clarification-log.md` in change directory.
Error Conditions: E-CHANGE-001 (Change not found), E-CLARIFY-001 (No ambiguous content detected)

**`mumuspec review <change-name> [--format json|md]`**
| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --format | string | 输出格式，默认 md |

Output: Creates `design-review.md` in change directory (or JSON to stdout).
Error Conditions: E-CHANGE-001 (Change not found), E-REVIEW-001 (design.md not found)

#### Guard New Error Codes

| Code | Severity | Message Template |
|------|----------|------------------|
| E-DESIGN-009 | ERROR | "Design 文档缺少必填字段: {fields}" |
| E-DESIGN-010 | ERROR | "跨工件不一致: {diff_summary}" |
| E-DESIGN-011 | ERROR | "AI 自审发现 CRITICAL 问题: {issues}" |
| W-DESIGN-001 | WARN | "任务 {task_id} 粒度过大 ({est} min)，建议拆分" |

#### State Extended Fields

```yaml
clarify_result:
  completed: boolean
  questions_asked: integer
  questions_answered: integer

review_result:
  completed: boolean
  critical_count: integer
  major_count: integer
  minor_count: integer
```

## Lessons

从 design.md 提取的架构设计经验：
- 新增 CLI 命令需定义完整错误码和输出契约
- AI 自审机制需要分级处理避免警告疲劳
- 一致性检查应集成到现有 guard 流程中而非独立命令
- 可选工具（clarify）应独立为命令降低阶段内聚耦合

## Risks

- **AI 自审可能产生误报导致开发者频繁忽略警告**: 需要分级机制（CRITICAL/MAJOR/MINOR），只有 CRITICAL 阻塞
- **一致性检查在大型项目中性能如何**: 纯文本匹配复杂度 O(n*m)，可接受；未来可增量检查

## Hyperplan

Hyperplan adversarial review: executed, no material issues found
