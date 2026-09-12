# Verify: evaluator-weight-single-source

## 测试结果

### 单元测试（本变更相关）

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/core/metrics/weight-single-source.test.ts（新增） | 6 | PASS |
| tests/core/metrics/freedom-suggestions.test.ts | 12 | PASS |
| tests/core/metrics/design-build-first-pass.test.ts | 11 | PASS |
| tests/core/metrics/（全部） | 47 | PASS |
| tests/structure-validator.test.ts（含新增 TC-3） | 3 | PASS |
| tests/change/（全部） | 622 | PASS |
| **合计（受影响）** | **780 用例 / 37 文件** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 265（265 PASS） |
| 测试用例 | 5044（5044 PASS） |

### TypeScript 编译

- `npm run build`（tsc + copy-assets）— 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 在 types.ts 或任何共享模块中保留可与之漂移的权重副本 | 合规 | 4 个 evaluator 成功返回 `weight` 均改为引用自身 `defaultWeight`；grep 确认无 `weight: 0.25/0.35/0.15` 字面量残留；L0-5 防漂移测试锁定 |
| SHALL NOT 存在产出物无消费者的死端 | 合规 | `defaultWeight` 成为唯一权威源并被成功路径消费；`weight: 0` 仅剩语义化的 nullResult/constraint-density |
| 禁止用复杂方案替代简单方案 | 合规 | 采用方案 P1-3 选项 (a)（引用常量），未改动 `Evaluator` 接口语义 |
| 禁止绕过变更状态机直接修改代码 | 合规 | 全部改动在变更 `evaluator-weight-single-source` 上下文内，经 guard 逐阶段转换 |

## 行为验证

| 验证项 | 方法 | 结果 |
|--------|------|------|
| test-pass-rate 返回 weight=0.3（非旧 0.35） | L0-1：mock vitest JSON，`evaluate()` 返回 `weight === defaultWeight` | PASS |
| drift-score 返回 weight=0.2（非旧 0.25） | L0-2：mock drift JSON | PASS |
| spec-compliance 返回 weight=0.2（非旧 0.25） | L0-3：mock guard JSON | PASS |
| code-delta 两分支均返回 weight=0.1（非旧 0.15） | L0-4：无变化分支 + 有变化分支 | PASS |
| 防漂移不变量 | L0-5：5 个 active `defaultWeight` 之和 = 1；成功返回 weight 逐项 == defaultWeight | PASS |
| `.mumuspec/evolution/` 白名单 | TC-3：创建 evolution/ 目录不再报 E-SPEC-013；`mumuspec validate` exit 0 | PASS |

## 明确不做（单独变更）

- **E17**：spec-compliance / drift-score 的 CLI 调用参数与其输出契约不匹配（guard `--json` 输出
  `{passed: boolean}` 而非计数、drift `--json` 输出数组而非 `{totalViolations, totalChecks}`）。
  修复需评估器数据源重新设计，非简单参数改正——单独变更。

## 测试不可变性

- Layer 0 用例 5 条（L0-1..L0-5）全部有对应实现与断言覆盖