# Verify: archive-prune-safety

## 测试结果

### 单元测试

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/change/finalize-archive-idempotency.test.ts | 4 | PASS |
| tests/cli/commands/finalize-archive-extra2.test.ts | 41 | PASS |
| tests/cli/commands/finalize-archive-branches.test.ts | 10 | PASS |
| tests/core/consistency/metadata-alignment.test.ts | 2 | PASS |
| **合计** | **57** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 256（255 PASS / 1 FAIL） |
| 测试用例 | 4969（4968 PASS / 1 FAIL） |

唯一失败：`tests/cli/cli-smoke.test.ts > mumuspec check runs (dogfooding) with exit 0`。
失败根因为 59 条既有 E-GUARD-003 违规（单一规则宽匹配），与本次变更无关，
与上一变更 `freedom-metrics-loop-closure` 归档时的基线一致（同为 4969 用例 1 FAIL）。

### TypeScript 编译

- `npx tsc --noEmit` — 0 errors

## 行为验证

| 验证项 | 方法 | 结果 |
|--------|------|------|
| 陈旧归档条目不再被删除 | `tests/change/finalize-archive-idempotency.test.ts` 用例 ②：构造 mtime 为 40 天前的归档条目，执行 finalize-archive 后断言目录与目录内文件仍存在 | PASS |
| 陈旧条目仍被报告 | 同一用例断言输出包含条目名 | PASS |
| 不执行任何删除调用 | `finalize-archive-extra2.test.ts` 断言 `rmSync` 未被调用 | PASS |
| readdir 异常不影响主流程 | `finalize-archive-branches.test.ts` 用例断言命令正常完成 | PASS |

## 测试不可变性

- `test-cases lock` 已执行，hash: `b1de5440f9a8d518`
- Layer 0 用例 4 条全部有对应实现与断言覆盖
