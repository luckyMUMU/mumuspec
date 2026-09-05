# BOUNDARY: src/change/

> 目录边界文档（AGENTS.md 契约规则义务）。变更本目录对外接口前必须先更新此文件。

## 对外接口

| 符号 | 文件 | 说明 |
|------|------|------|
| 变更生命周期 | lifecycle.ts | create/discard/escalate/snapshot/build-layers/test-cases（init/lock/hash/verify/lock-suite） |
| 变更管理入口 | manager.ts | 面向 CLI 的聚合门面 |
| 状态机 | state.ts | phase/branch/build_layers 持久化与转换 |
| **artifact-validator（新增）** | artifact-validator.ts | 纯函数校验器：`validateArtifact(root, changeName, kind)` → `{ isValid, errors: { code, path, message }[] }`；kind ∈ 'open-questions' \| 'assumptions'；工件 schema version: 1 |

## 依赖声明

- `src/core/`（errors、utils、yaml 解析既有依赖）
- decisions.md 文本（decision_ref 交叉断言的数据源）

## 数据契约

- **工件 schema v1**（open-questions.yaml / assumptions.yaml 同构，键名 items[].question|assumption、前缀 OQ-|AS-）：
  - `version: 1`、`change: <name>`、`items[]`；item：`id`、`question|assumption`、`status: open|resolved|accepted|deferred`
  - `status != open` ⇒ `resolution.decision_ref` 必填且须在 decisions.md 条目（`## [<phase>] <时间戳>`）中命中
  - `deferred` ⇒ `resolution.note` 必填
- fail-closed：YAML 解析异常按 schema 非法处理（E-CHANGE-020）；decision_ref 未命中 → E-CHANGE-021。
- 校验器纯函数、无副作用；guard 是唯一门禁消费方。

## 变更日志

| 日期 | 变更 | 关联 |
|------|------|------|
| 2026-09-01 | 首建；登记 artifact-validator 与工件 schema v1 | goal-p0-dispatch-gate（C4/E-CHANGE-020/021） |
