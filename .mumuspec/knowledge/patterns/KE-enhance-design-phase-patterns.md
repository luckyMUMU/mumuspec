---
id: KE-enhance-design-phase-patterns
title: Architecture patterns from enhance-design-phase
type: pattern
status: confirmed
scope: enhance-design-phase
created_at: 2026-08-01
tags:
  - auto-extracted
  - pattern
  - architecture
  - enhance-design-phase
graph_bindings: []
---
> Auto-extracted from enhance-design-phase/design.md

# Design: enhance-design-phase

## 1. API Contracts

### 1.1 New CLI Commands

#### `mumuspec clarify <change-name> [--max-questions N]`

| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --max-questions | integer | 最大澄清问题数，默认 5 |

**Output:** Creates `clarification-log.md` in change directory.

**Error Conditions:**
- E-CHANGE-001: Change not found
- E-CLARIFY-001: No ambiguous content detected (info, not error)

#### `mumuspec review <change-name> [--format json|md]`

| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --format | string | 输出格式，默认 md |

**Output:** Creates `design-review.md` in change directory (or JSON to stdout).

**Error Conditions:**
- E-CHANGE-001: Change not found
- E-REVIEW-001: design.md not found

### 1.2 Guard New Error Codes

| Code | Severity | Message Template |
|------|----------|------------------|
| E-DESIGN-009 | ERROR | "Design 文档缺少必填字段: {fields}" |
| E-DESIGN-010 | ERROR | "跨工件不一致: {diff_summary}" |
| E-DESIGN-011 | ERROR | "AI 自审发现 CRITICAL 问题: {issues}" |
| W-DESIGN-001 | WARN | "任务 {task_id} 粒度过大 ({est} min)，建议拆分" |

### 1.3 State Extended Fields

```yaml
# 新增 state 字段
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

---

## 2. Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                              CLI                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  mumuspec clarify X                                          │
│       │                                                      │
│       ▼                                                      │
│  ┌──────────────────────┐                                    │
