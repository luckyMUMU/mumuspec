# Layer 2 — behavior-gate 五态与发射面
## TC-L2-001 resolveGate 五态（纯函数表驱动）
| gate_ref 场景 | 期望 |
|---|---|
| error-code:E-SPEC-015（已注册且语料命中） | ok |
| error-code:E-BOGUS-999 | fail: unregistered |
| error-code:E-SPEC-005（注册但无语料 mustContain） | fail: no-corpus |
| corpus:bad-gate-001（存在且声明非空） | ok |
| corpus:no-such-fixture | fail: missing |
| gate_ref 缺失/前缀不识别 | fail: malformed |
## TC-L2-002 分类与阻断
| 步骤 | 期望 |
|---|---|
| frontmatter/条目挂合法 gate 注解 | cls=enforced-strong，计入 strong 桶 |
| 挂悬空 gate | check errors 含 E-GUARD-013；--force 不可越过（forceable:false） |
| validate JSON schema | 仅追加新字段，既有结构不变 |
## TC-L2-003 语料
| fixture | probe | 期望 |
|---|---|---|
| bad-gate-001 | check | mustContain E-GUARD-013 |
| clean-05 | check | mustNotContain E-GUARD-013 |
| corpus-fixtures L2-C13 | — | 17 码各恰 1 例聚合绿 |
