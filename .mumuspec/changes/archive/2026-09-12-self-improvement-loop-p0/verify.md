# Verify: self-improvement-loop-p0

## 测试结果

### 单元测试（本变更相关）

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/cli/commands/guard-handler.test.ts | 16 | PASS |
| tests/cli/commands/meta-evolve.test.ts | 8 | PASS |
| tests/meta-evolution/stats.test.ts | 6 | PASS |
| tests/eval/experiment-engine-deep.test.ts | 51 | PASS |
| tests/eval/experiment-engine-extra.test.ts | 40 | PASS |
| tests/cli/commands/loop-experiment-extra3.test.ts | 47 | PASS |
| tests/change/loop-engine-deep.test.ts | 46 | PASS |
| tests/cli/commands/check-json.test.ts | 35 | PASS |
| **合计** | **249** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 264（264 PASS） |
| 测试用例 | 5037（5037 PASS） |

全绿（沙箱外运行；沙箱内的 3 例失败系测试临时目录 `D:\_tmp_*` 被沙箱拒绝写入，非代码回归）。

### TypeScript 编译

- `npm run build`（tsc + copy-assets）— 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录） | 合规 | P0-4：`loop-engine.ts` 提交失败写 `audit result:'fail'` 并 rethrow（`loop-engine-deep` 用例覆盖）；auto-eval 降级仅限只读采集失败且留 audit |
| SHALL NOT 存在产出物无消费者的死端 | 合规 | P0-2：`recordCheck` 新增调用方（`guard.ts`），`readCheckRecords` 被 `meta-evolve --analyze/--propose` 消费 |
| SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净 | 合规 | P0-2：空数据集显式打印 `No check records accumulated yet`，`--propose` 不再对空数据输出 `Constraints are healthy`；知识索引不可得显式声明 |
| 禁止代码静默消费校验失败的规则（fail-open） | 合规 | P0-3：`meta-evolve --apply --confirm` 未实现即 exit 1，不再占位 exit 0 |
| SHALL NOT 约束内容使用无具体含义的占位符文本 | 合规 | 本变更不新增约束文本 |
| 先校验器后消费者 | 合规 | P0-1 落盘复用既有 `recordCheck`/`CheckRecord`（已有校验器），未引入新结构化产出物 |

## 行为验证（E2E 实测）

| 验证项 | 方法 | 结果 |
|--------|------|------|
| guard 落盘相位聚合记录 | 真实运行 `mumuspec guard self-improvement-loop-p0 design` 后读取 `.mumuspec/evolution/stats.jsonl`，出现 `{"constraintId":"guard:design","passed":true}` | PASS |
| meta-evolve 读真实记录 | `--analyze` 输出 `guard:design: 1.00 [low confidence]`（非 `No check records`） | PASS |
| --propose 非空数据 | 输出 `No issues detected`（基于真实记录，1 条记录无低分约束） | PASS |
| --propose 空数据诚实 | 单测：输出 `无法评估约束健康度`、不输出 `Constraints are healthy` | PASS |
| knowledge 索引不可得显式声明 | 单测：输出 `knowledge index unavailable — skipped` | PASS |
| --apply fail-closed | `meta-evolve --apply --confirm` → stderr 错误 + exit 1 | PASS |
| experiment 封存 | 引擎 `initExperiment` 置 `enabled:false`；CLI `adopt` 对 `enabled:false` 拒绝 exit 1；`init` 打印警告 | PASS（单测） |

## 测试不可变性

- Layer 0 用例 11 条（L0-1..L0-11）全部有对应实现与断言覆盖