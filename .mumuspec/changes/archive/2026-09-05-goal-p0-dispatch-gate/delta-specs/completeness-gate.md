# Delta Spec: 完备性门禁 v1

## Requirement: 结构化完备性工件

设计完备性判定必须产出机器可读的结构化工件，而非自由文本结论。

### SHALL

- Design 与 Verify 阶段产出 `open-questions.yaml`（未决问题清单）与 `assumptions.yaml`（未确认假设清单），均带 `version:` 字段。
- 每条未决问题 / 假设携带状态（open / resolved / accepted / deferred）与消解去向（决策日志条目 id）。
- 工件写入变更目录并纳入变更状态管理。

### SHALL NOT

- 禁止以自由文本形式声明"设计完备"（完备性结论必须可由工件状态推导）。
- 禁止把"完备"与"正确"混同：完备性工件不得包含正确性断言（正确性由 test-cases 锁定与 Verify 承担）。

### Enforcement

- ENF-1: enforced-strong(schema 校验：字段、状态枚举、version 存在)
- ENF-2: enforced-strong(工件状态与 decisions 日志交叉断言：resolved 条目必有决策去向)

## Requirement: 双签门禁

完备性门禁 = LLM 判定（advisory）+ 人工签收（放行条件），机械校验保持一票否决。

### SHALL

- design→build 转换时，phase-guard 校验：存在 open 状态未决问题且未经人工签收（accept/defer 带理由）时返回 block。
- LLM 完备性判定仅以 advisory 身份进入 guard 结果，不得单独放行。
- 机械四分类校验（enforced-strong / enforced-weak / manual / unverifiable）保持既有 block 语义不变。

### SHALL NOT

- 禁止在无人工签收记录的情况下因 LLM 判定"完备"而放行阶段转换。
- 禁止降级或绕过机械四分类的一票否决。

### Enforcement

- ENF-3: enforced-strong(guard 单元测试：无签收 + LLM 判完备 → 断言 block)
- ENF-4: enforced-strong(guard 单元测试：机械校验失败 → 断言 block 优先于任何 advisory 结论)
- ENF-5: manual(真实变更中人工签收流程可用性走查，evidence 记入 verify.md)
