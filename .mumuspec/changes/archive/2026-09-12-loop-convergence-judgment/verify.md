# Verify: loop-convergence-judgment

## 测试结果

### 单元测试（本变更相关）

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/core/metrics/auto-evaluate.test.ts（TC-06 改 roundHistory 驱动 + hybrid 判据） | 19 | PASS |
| tests/core/metrics/collect-metrics.test.ts | 5 | PASS |
| tests/change/loop-engine.test.ts | 53 | PASS |
| tests/change/loop-engine-deep.test.ts（收敛语义更新 + E16） | 46 | PASS |
| tests/change/loop-evaluation-suggestions.test.ts | 4 | PASS |
| **合计（受影响）** | **127 用例 / 5 文件** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 265（264 PASS / 1 修复后全绿） |
| 测试用例 | 5048（5048 PASS） |

唯一失败为 `metadata-alignment` STATUS.md 版本漂移（归档 bump 至 0.23.0-alpha.1 未同步），已同步修复。

### TypeScript 编译

- `npm run build`（tsc + copy-assets）— 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 引入运行时从注册表动态推导 map 的机制 | 合规 | 未引入动态推导；稳定窗口历史改读持久化 `roundHistory`（事实源唯一） |
| SHALL NOT 因新增命令而改变既有 loop evaluate 通道的收敛语义 | 合规 | 未新增命令；收敛判据三处统一为同一语义（P1-2 要求） |
| 禁止代码静默消费校验失败的规则（fail-open） | 合规 | `--force` 等通道未受影响；converged 不再被 progress 字段"伪命中" |
| SHALL NOT 用 try/catch 吞掉副作用失败 | 合规 | 本变更未触碰 commit/audit 路径（P0-4 已修） |
| 禁止绕过变更状态机直接修改代码 | 合规 | 全部改动在变更 `loop-convergence-judgment` 上下文内，经 guard 逐阶段转换 |

## 行为验证（E14 三处 + E16）

| 验证项 | 方法 | 结果 |
|--------|------|------|
| 单轮高分不再收敛 | L0-1：roundHistory 空 + 当前轮高分 → `goalAchieved=false` | PASS |
| 跨进程连续 3 轮达标才收敛 | L0-2：roundHistory 2 轮达标 + 当前轮 → `goalAchieved=true`（历史来自持久化轮次，非内存 Map） | PASS |
| 历史含低分轮窗口不通过 | L0-3：roundHistory 含 0.5 → `goalAchieved=false` | PASS |
| hybrid 判据统一 | L0-4：hybridProgress ≥ 0.85 但窗口空 → `goalAchieved=false`；窗口满 → true | PASS |
| 单轮高分不再触发 loop converged | L0-5：evaluateRound `{progress:0.9, goal_achieved:false}` → phase=plan | PASS |
| goal_achieved 才收敛且不提交（E16） | L0-6：`{progress:0.9, goal_achieved:true}` → phase=converged、should_commit=false | PASS |
| initLoop max_rounds 告警 | L0-7：auto 模式 max_rounds=2 → WARN；默认 3 → 静默 | PASS |

## 测试不可变性

- Layer 0 用例 7 条（L0-1..L0-7）全部有对应实现与断言覆盖