---
id: "IMPORT-FEEDBACK__TEMPLATE_SESSION_SUMMARY_TEMPLATE"
title: "<会话简短标题,如 \"为 API 层添加分页查询规范\">"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - feedback-template
source: "feedback/_template/session-summary-template.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# <会话简短标题,如 "为 API 层添加分页查询规范">

> **Source**: `feedback/_template/session-summary-template.md` | **Type**: feedback-template | **Imported**: 2026-07-31

## Summary

> **Session ID**: `<session_id>` > **Agent**: `<agent> <agent_version>` > **结果**: `<outcome>`

## Original Content

---
date: 2026-07-28
session_id: <uuid 或简短 hash>
agent: <claude-code|cursor|codex|opencode|custom>
agent_version: <1.x.x>
mumuspec_version: 0.12.1-alpha.0
project_type: <greenfield|brownfield|legacy|demo>
change_type: <feature|hotfix|tweak|build|archive>
duration_minutes: <估算>
outcome: success  # success | partial | failure | abandoned
change_name: <关联的变更名称>
feedback_ids:
  - <关联的用户反馈 ID，如 FB-20260728-a1b2c3d4>
  - <更多反馈 ID>
---

# <会话简短标题,如 "为 API 层添加分页查询规范">

> **Session ID**: `<session_id>`
> **Agent**: `<agent> <agent_version>`
> **结果**: `<outcome>`

## 1. 会话目标
<本次 session 试图完成什么>

## 2. 实际走完的流程
- [ ] Open (提案 + delta-specs)
- [ ] Design (设计文档 + 认知框架)
- [ ] Build (实现 + 测试)
- [ ] Verify (验证报告)
- [ ] Archive (归档 + 知识提取)

<未完成的阶段说明原因>

## 3. 触发的约束
<本次会话中被 MumuSpec 守卫触发过的约束 (SHALL / SHALL NOT),按时间顺序>

- [ ] worktree_isolation: <触发时机与结果>
- [ ] single_active_change: <...>
- [ ] top_down_design: <...>
- [ ] tdd_enforced: <...>
- [ ] <其他约束 id>

## 4. 阻断点与回退
<遇到的具体阻断 (Phase Guard / Constraint Evaluator),如何处理>

- 阻断点 1: <描述> → 处理方式: <修复 / 回退 / 关闭约束>
- 阻断点 2: ...

## 5. 走捷径点 (重要)
<哪些约束本应触发但没有,或 Agent 主动绕开了的>

- 期望触发但未触发: <约束 id + 场景>
- 主动绕开: <约束 id + 理由 + 是否在 decisions.md 记录>

## 6. 沉淀模式 (Patterns Observed)
<本次会话中观察到的可复用模式或反模式>

- 模式 1: <描述> — 可推广 / 需要制止
- 模式 2: ...

## 7. 设计盲区 (Q4 - 未知未知)
<本次会话暴露的设计未覆盖的场景>

- 盲区 1: <描述> → 建议补充到 <overview.md / constraint-strength.md / ...>
- 盲区 2: ...

## 8. 关联用户反馈
<本次会话中提交或关联的用户反馈>

- FB-20260728-xxxxx: <标题>
- <更多反馈>

## 9. 知识页面
<本次会话生成或引用的 Knowledge Pages (KP-xxx)>

- KP-001: <标题>
- KP-002: <标题>

## 10. 关键工件引用
<本次会话产出的关键文件路径 (相对仓库根)>

- .mumuspec/changes/<change-id>/proposal.md
- .mumuspec/changes/<change-id>/design.md
- .mumuspec/changes/<change-id>/verify.md

