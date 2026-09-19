# Delta Spec: 基准可信度——条目注解通道与断言对账

## Requirement: constraints.yaml 条目机器强制面

constraints.yaml 条目与 spec.md 约束条目共享同一可验证性判定序与执行流水线，注解命中即机器执行。

### SHALL

- constraints.yaml 条目的可验证性类别判定 SHALL 复用 spec 条目的同一判定序实现（单一判定序，出处 verifier-classify）。
- 带机读注解的条目 SHALL 被 guard 执行流水线真实检查（forward 未满足即 E-GUARD-012，reverse 违反即 E-GUARD-003），并计入 enforcement_coverage。
- annotate 对条目输出的注解建议 SHALL 以只读形态呈现，回写须人工签收。

### SHALL NOT

- 禁止为 constraints.yaml 条目另立第二套分类判定逻辑（须复用既有判定序）。
- 禁止对账通道以语义判断决定进度好坏（只核对断言与事实的矛盾）。

### Enforcement

- ENF-1: enforced-strong(单测断言：条目判定序与 spec 条目同函数出处；tests/spec/verifier-entry-annotation.test.ts)
- ENF-2: enforced-strong(端到端断言：带注解条目在违规源上触发 E-GUARD-012/003；tests/guard/constraints-entry-channel.test.ts)
- ENF-3: manual(verify.md 记录：annotate 输出不改动 constraints.yaml 文件的核对)
- ENF-4: manual(代码审阅：对账通道无评分/好坏判断分支)

## Requirement: STATUS 断言对账通道

docs/STATUS.md 的机器可核断言与仓库事实逐项对账，矛盾必须可见。

### SHALL

- 包版本、能力层实现进度、命令与工具数量、更新日期四类断言 SHALL 经确定性对账，矛盾项以 E-DRIFT-016 在 check 的 drift 数组恒可见（strict 下阻断）。
- 对账通道的解析失败 SHALL 走 fail-safe 留痕（可见 WARN），不阻断其余检查源。

### Enforcement

- ENF-1: enforced-strong(表驱动单测：四类断言矛盾/一致/不可解析三态；tests/guard/status-assertion.test.ts)
- ENF-2: enforced-strong(语料断言：bad-drift-001 必命中、clean-04 零误报；eval-corpus 聚合)
- ENF-3: enforced-strong(CI 断言：ci-check 对账步骤矛盾即 exit 1)
