---
id: DS-EVAL-003
layer: 0
scope: .
delta: ADDED
---

## Requirement: weight=0 评估器注册

### SHALL
- SHALL verifiable-ratio 评估器以 weight 0 注册：取 validate JSON 输出的 coverage 四分类占比，value 为 strong_ratio，rawData 含四分类计数。
- SHALL fail-open-count 评估器以 weight 0 注册：读 audit.log 统计 result 非 success 条目并按 action 分组输出计数与清单。

### SHALL NOT
- SHALL NOT 新评估器改变既有 loop composite 权重之和、收敛阈值与稳定窗口。
- SHALL NOT 评估器数值由 LLM 计算或手写。

Enforcement: evaluator-registry 注册断言单测（名称、weight=0、权重和不变三重校验）。
