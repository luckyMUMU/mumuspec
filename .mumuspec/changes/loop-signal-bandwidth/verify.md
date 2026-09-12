# Verify: loop-signal-bandwidth

## 测试结果

### 单元测试（本变更相关）

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/change/loop-evaluation-suggestions.test.ts（含 P1-1 新增 3 用例） | 7 | PASS |
| tests/change/loop-engine.test.ts | 53 | PASS |
| tests/change/loop-engine-deep.test.ts | 46 | PASS |
| **合计（受影响）** | **106 用例 / 3 文件** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 266（265 PASS / 1 修复后全绿） |
| 测试用例 | 5061（5061 PASS） |

唯一失败为 `metadata-alignment` STATUS.md 版本漂移（归档 bump 至 0.23.0-alpha.3 未同步），已同步修复。

### TypeScript 编译

- `npm run build`（tsc + copy-assets）— 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 存在产出物无消费者的死端 | 合规 | `issues`/`needs_user_input` 由"生产者有、终点写死"变为透传+采集，`blocked` 分支在 auto 模式重新可达 |
| 禁止引入未被请求的抽象层（YAGNI） | 合规 | 复用既有 `runPhaseGuard` 与 `LoopEvaluation.issues`，未新增类型/机制 |
| 禁止用复杂方案替代简单方案 | 合规 | 透传 + 一行循环采集，未引入信号中间层 |
| 禁止绕过变更状态机直接修改代码 | 合规 | 改动在变更 `loop-signal-bandwidth` 上下文内，经 guard 逐阶段转换 |

## 行为验证（E11）

| 验证项 | 方法 | 结果 |
|--------|------|------|
| issues 透传 | L0-1：`{issues:['pre-existing issue']}` → 记录包含该 issue | PASS |
| needs_user_input 透传 | L0-2：`{needs_user_input:true}` → 记录为 true | PASS |
| guard 失败 code 采集 | L0-3：`[guard:E-GUARD-001] proposal.md 不存在` 入 issues，按 code+message 去重 | PASS |
| manual 模式不变 | L0-4：不改写传入 evaluation | PASS |

## 测试不可变性

- Layer 0 用例 4 条（L0-1..L0-4）全部有对应实现与断言覆盖