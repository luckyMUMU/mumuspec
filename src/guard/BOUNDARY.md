# BOUNDARY: src/guard/

> 目录边界文档（AGENTS.md 契约规则义务）。变更本目录对外接口前必须先更新此文件。

## 对外接口

| 符号 | 文件 | 说明 |
|------|------|------|
| phase guard 检查链 | phase-guard.ts | design/build/verify 各阶段前置检查；BP-3 阻塞点需 `--confirm` |
| **完备性门禁挂钩（新增）** | phase-guard.ts | design→build 消费 `open-questions.yaml`；build→verify 消费 `assumptions.yaml`；判定 = 工件全部消解 + resolution.decision_ref 在 decisions.md 命中 |

## 依赖声明

- `src/change/artifact-validator.ts`（工件校验，fail-closed）
- `src/core/errors.ts`（E-CHANGE-020/021）
- 既有：checker.ts、errors、utils

## 数据契约

- 门禁唯一依据 = 工件状态 + decisions.md 交叉断言；**LLM advisory 字段不进判定路径**（红线）。
- 非法工件（schema 违规）→ guard 拒绝执行而非降级（E-CHANGE-020；resolution 链断裂 → E-CHANGE-021）。
- 工件缺失分支：无 `open-questions.yaml` 且 design.md 未声明"无未决问题"→ block；工件内 advisory 完备声明不改变判定。
- 只增不改：新挂钩与既有检查取交集（任一 block 即 block），机械四分类一票否决语义不动。

## 变更日志

| 日期 | 变更 | 关联 |
|------|------|------|
| 2026-09-01 | 首建；登记完备性门禁挂钩（design→build、build→verify 双签） | goal-p0-dispatch-gate（C4/ENF-3/ENF-4） |
