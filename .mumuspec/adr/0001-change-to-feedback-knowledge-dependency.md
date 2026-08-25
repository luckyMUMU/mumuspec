---
id: ADR-0001
title: change 模块对 feedback/knowledge 的单向运行时依赖
status: accepted
date: '2026-08-04'
scope: src/change
---

# ADR-0001: change 模块对 feedback/knowledge 的单向运行时依赖

## 状态

已接受 (Accepted)

## 背景

`src/change/lifecycle.ts` 中的 `createChange` 函数在创建变更时需要执行以下原子操作:

1. 创建变更专属的 feedback 目录结构 (`feedback/ets/`, ets=effort-to-score)
2. 在全局知识库中注册与该变更关联的知识页 (knowledge pages)

这导致 `change` 模块在运行时需要调用 `feedback/manager.js` 和 `knowledge/manager.js` 的接口。

## 决策

维持 **change → feedback/knowledge** 的单向运行时依赖。

### 理由

1. **原子性要求** — 变更创建是一个原子操作，要么全部成功要么全部失败。如果通过中间层解耦（如事件总线），会增加错误处理的复杂度，且需要引入新的抽象层（违反 YAGNI）。
2. **使用频率低** — 这些依赖仅在 `createChange` 和 `archiveChange` 时被调用，不是热路径。
3. **反向依赖不存在** — feedback/ 和 knowledge/ 模块完全不依赖 change/，保持单向。
4. **模块边界清晰** — change/ 通过 BOUNDARY.md 明确声明这些依赖，不存在隐式契约。

### 被拒绝的替代方案

| 方案 | 拒绝理由 |
|------|----------|
| 引入事件总线 | 过度设计，当前无多订阅者场景 |
| 延迟初始化（lazy init） | 违背原子性要求，可能导致不一致状态 |
| 将 feedback/knowledge 操作移到 CLI 层 | 违反单一职责原则，CLI 层不应包含业务逻辑 |

## 后果

- change/ 的测试需要 mock feedback/ 和 knowledge/ 的接口（已通过现有测试覆盖）
- 未来若 feedback/ 或 knowledge/ 接口签名变更，需同步更新 change/ 的调用点

## 参考

- `src/change/BOUNDARY.md` — 依赖声明章节
- `src/lifecycle.ts` — createChange 实现
