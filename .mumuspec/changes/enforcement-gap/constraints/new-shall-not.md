# New SHALL NOT Constraints

- 禁止为 constraints.yaml 条目另立第二套分类判定逻辑（须复用 verifier-classify 判定序）。
- 禁止对账通道以语义判断决定进度好坏（只核对"断言 vs 事实"矛盾）。
- 禁止改变 check/validate 既有 JSON schema 结构（drift 项仅追加新 type 值）。
- 禁止 LLM 计算或手写对账结果与 coverage 数值。
