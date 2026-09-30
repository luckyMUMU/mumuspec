# Layer 0 — 审查缺口补测 (test-only, 零生产行为变更)

> 文件位置: `tests/spec/strip-channel-marker.test.ts`、`tests/guard/behavior-gate.test.ts`
> 工具: vitest + 临时目录隔离（mkdtempSync）
> 来源: engine-consolidation 归档后代码审查的两个 Important 缺口

---

## TC-L0-001: agent 行为约束 带/不带通道前缀 等价（TC-L1-002 第 2 行兑现）

**场景**: agent 行为类红线（如"禁止以 --force 越过 E-SPEC-015"族）带 `lex:` 前缀与不带前缀,经 `isAgentBehaviorConstraint`（checker.ts:337 入口）判定等价——前缀剥离后豁免路径一致,前缀不再造成假豁免或假扫描。

| 步骤 | 期望 |
|------|------|
| 构造临时项目,src/ 内含带 `lex: ` 前缀的 agent 行为类红线文本 | `isAgentBehaviorConstraint(剥离后文本)` 为 true,该条不进入词法扫描（无 E-GUARD-003 误报）|
| 同一文本去掉 `lex: ` 前缀 | `isAgentBehaviorConstraint` 判定与带前缀时相同 |
| 端到端: 两种形态各跑一次 check | 两者 violation 集合一致（均不因前缀产生差异）|

---

## TC-L0-002: E-GUARD-013 注册元数据断言

**场景**: 防止 E-GUARD-013 的红线属性（ERROR、不可 force、恒强制）被无意修改而测试不红。

| 步骤 | 期望 |
|------|------|
| 读取 `ERROR_CODES['E-GUARD-013']` | 存在且 `severity === 'error'` |
| 同上 | `forceable === false`（--force 不可越过）|
| 同上 | `always_enforce === true`（任何强度组合恒可见）|
