# New SHALL Constraints

- 每条 constraints.yaml 约束条目与 spec.md 约束条目 SHALL 经同一分类判定序得出可验证性类别（单一权威源）。
- 约束的机读注解命中且对应通道真实执行时，该约束 SHALL 被归为 enforced-strong 并计入 enforcement_coverage。
- `docs/STATUS.md` 的机器可核断言 SHALL 与仓库事实逐项对账，矛盾项 SHALL 经 `mumuspec check` 的 drift 数组可见。
- 分类、对账结果与指标值 SHALL 全部由确定性代码推导。
