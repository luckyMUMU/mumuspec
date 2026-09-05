# Test Cases - Layer 0: artifact-validator（工件 schema v1 校验器）

> 测试文件：`tests/artifact-validator.test.ts`
> 被测模块：`src/change/artifact-validator.ts`（新建，纯函数 + 诊断，fail-closed）
> 错误码：E-CHANGE-020（工件 schema 非法）/ E-CHANGE-021（resolution 链断裂）

## Cases

### TC-B1: 工件 schema 非法 → E-CHANGE-020，guard 拒绝消费
- **可验证性**: enforced-strong
- **Given**: 临时目录含 `decisions.md`（含合法条目）与待校验工件
- **When/Then**（子断言，每个均应返回诊断且错误码 = E-CHANGE-020，isValid = false）:
  1. 缺 `version` 字段 → E-CHANGE-020
  2. `version: 2`（schema v1 不识别）→ E-CHANGE-020
  3. 缺 `items` 字段 → E-CHANGE-020
  4. `items` 非数组（字符串/对象）→ E-CHANGE-020
  5. item 缺 `id` 或 `question`（assumption 侧：`assumption`）→ E-CHANGE-020
  6. `status` 非法枚举值（如 `"done"`）→ E-CHANGE-020
  7. `status: resolved` 但缺 `resolution` 对象 → E-CHANGE-020（schema 层缺字段）
  8. `status: resolved`、有 `resolution.decision_ref` 但类型非字符串 → E-CHANGE-020
- **断言补充**: 返回结构含 `errors: { code: 'E-CHANGE-020', path }[]`；`isValid === false`。

### TC-B1x: 合法工件通过校验（正向基线）
- **可验证性**: enforced-strong
- **Given**: `open-questions.yaml`（version: 1、change 匹配、1 个 open item + 1 个 resolved item 带 decision_ref 指向 decisions.md 实存条目 + 1 个 accepted item 带 decision_ref + 1 个 deferred item 带 decision_ref 与 note）
- **When**: `validateArtifact(root, changeName, 'open-questions')`
- **Then**: `isValid === true`，`errors` 为空；同构文件 `assumptions.yaml`（键名 assumption、前缀 AS-）同样通过。

### TC-B3: decision_ref 指向不存在条目 → E-CHANGE-021
- **可验证性**: enforced-strong
- **Given**: 工件 schema 合法，`resolution.decision_ref = "2026-09-01T00:00:00Z"`，但 `decisions.md` 中无该时间戳条目
- **When**: `validateArtifact(...)`
- **Then**: 错误码 = E-CHANGE-021，诊断含未命中的 decision_ref 值；`isValid === false`
- **子断言**: decision_ref 为 decisions.md 中实存条目的时间戳（`## [open] <时间戳>` 格式，允许任意 phase 头）→ 校验通过（交叉断言命中）。

### TC-B3x: deferred 缺 note → E-CHANGE-021（语义层）
- **可验证性**: enforced-strong
- **Given**: `status: deferred`，resolution.decision_ref 命中，但缺 `note`
- **Then**: 错误码 = E-CHANGE-021（deferred 必填理由）；`isValid === false`

## 边界与不变式
- 校验器为纯函数：给定相同 root/change/kind 输入，输出确定；不做文件写入。
- fail-closed：任何解析异常（YAML 语法错误）→ E-CHANGE-020 + isValid=false，绝不静默通过。
- 判定唯一依据 = decisions.md 文本条目时间戳；不引入 LLM 语义判断路径。
