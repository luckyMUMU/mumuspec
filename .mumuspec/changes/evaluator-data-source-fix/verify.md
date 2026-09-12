# Verify: evaluator-data-source-fix

## 测试结果

### 单元测试（本变更相关）

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/core/metrics/data-source-contract.test.ts（新增） | 10 | PASS |
| tests/core/metrics/weight-single-source.test.ts（mock 契约更新） | 6 | PASS |
| tests/core/metrics/（全部） | 60 | PASS |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 266（265 PASS / 1 修复后全绿） |
| 测试用例 | 5058（5058 PASS） |

唯一失败为 `metadata-alignment` STATUS.md 版本漂移（归档 bump 至 0.23.0-alpha.2 未同步），已同步修复。

### TypeScript 编译

- `npm run build`（tsc + copy-assets）— 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 代码静默消费校验失败的规则（fail-open） | 合规 | 原 `guard --format json` 恒报错 → 恒 nullResult 属静默降级；新数据源 `check --json`/`drift --json` 真实可解析，`status != 0` 但含 payload 时照常计算（低分如实上报，非跳过） |
| SHALL NOT 存在产出物无消费者的死端 | 合规 | spec-compliance/drift-score 由此前恒 weight:0 缺席 composite → 首次真正进 composite 被 autoEvaluate 消费 |
| 禁止用复杂方案替代简单方案 | 合规 | 复用 constraint-density 已确立的 CLI-first + win32 shell + 多行 JSON 切片模式，未引入新抽象 |
| SHALL NOT 在 types.ts 或共享模块保留可漂移权重副本 | 合规 | 成功路径 weight 仍引用 defaultWeight 常量（weight-single-source 不变量延续） |

## 行为验证（E17 三层）

| 验证项 | 方法 | 结果 |
|--------|------|------|
| spec-compliance 真实合规率 | L0-1：`check --json` errors/total → `1 - errors/total` | PASS |
| check exit 1 时报低分而非跳过 | L0-2：payload 含 3 条 error、exitCode 1 → value 0.7、weight 0.2 | PASS |
| coverage 缺失诚实跳过 | L0-3：无 `coverage.total` → nullResult（不虚构分母） | PASS |
| drift 数组归一化 | L0-4：空数组 → 1.0；5 条 → 0.5；12 条 → 0（饱和） | PASS |
| spawn 失败诚实跳过 | L0-5：`result.error` → nullResult（win32 shell 无法解析 npx.cmd 不假满分） | PASS |
| 成功路径 weight 不变 | L0-6：两 evaluator `weight === defaultWeight` | PASS |

## 测试不可变性

- Layer 0 用例 6 条（L0-1..L0-6）全部有对应实现与断言覆盖