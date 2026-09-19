# Tasks: enforcement-gap

## L1 constraints.yaml 注解通道
- [ ] T1-1 `ConstraintEntry.annotation` 字段 + `classifyConstraintEntry` 判定序重写（测试先行）
- [ ] T1-2 `constraintEntryToItem` 适配器 + checker 接线（E-GUARD-012 执行 + coverage 合流）
- [ ] T1-3 `annotate` 输出 constraints.yaml 建议清单（只读）
- [ ] T1-4 L1 单测：判定序/开关两态/投影/端到端/五桶

## L2 status-assertion 对账通道
- [ ] T2-1 `status-assertion-checker.ts` 纯函数 + 表驱动单测（测试先行）
- [ ] T2-2 事实装配 + check drift 发射 + errors.ts 注册 E-DRIFT-016 + gen-error-codes
- [ ] T2-3 `ci-check.mjs` 接入对账步骤
- [ ] T2-4 `.eval-corpus/` bad-drift-001 / clean-04 fixture + runner 聚合绿
- [ ] T2-5 修正 STATUS.md 与代码矛盾的进度行，对账通道自身绿

## 收尾
- [ ] T3-1 regen-rules、版本 bump（package.json ↔ cli 一致）、CHANGELOG、全量测试
