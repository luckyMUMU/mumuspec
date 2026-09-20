# Layer 1 — 标记剥离归一
## TC-L1-001 表驱动
| 输入 | 期望 |
|---|---|
| `stripChannelMarker("lex:  Foo BAR")` | `"Foo BAR"`（首尾空白归一） |
| `stripChannelMarker("ast:x")` / `stripChannelMarker("plain")` | `"x"` / `"plain"` |
## TC-L1-002 同路径等价
| 场景 | 期望 |
|---|---|
| 系统行为文本 带/不带 lex: 前缀 各过 isCoexistenceConstraint | 结果相同（true） |
| agent 行为文本 带/不带前缀 过 isAgentBehaviorConstraint | 相同 |
| 词法扫描违规判定 带/不带前缀 对同文本报 E-GUARD-003 | 命中行号一致 |
## TC-L1-003 兼容红线
| 步骤 | 期望 |
|---|---|
| legacy_lexical_channel=true 全量既有断言 | R2 行为零变化（既有用例不回退） |
