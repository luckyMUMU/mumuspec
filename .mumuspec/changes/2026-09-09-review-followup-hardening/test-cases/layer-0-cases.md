# Test Cases - Layer 0

## Cases

### TC-1: 评估器权重不变量（W1 / ENF-1）

- 映射需求：delta-specs/single-source-of-truth.md「评估器权重单一权威源」
- 实现：tests/core/metrics/freedom-suggestions.test.ts（registry invariant 用例）
- 验证：registerBuiltInEvaluators 后活跃评估器（defaultWeight > 0）权重和 = 1（1e-9）；constraint-density 存在且 = 0；design-build-first-pass = 0.2
- 结果：通过（6 评估器 / sum 1.00）

### TC-2: moveDirSync 迁移三态（W2 / ENF-2 前置）

- 映射需求：delta-specs/single-source-of-truth.md「archive 幂等化」
- 实现：tests/change/archive-idempotency.test.ts（moveDirSync describe 块）
- 验证：目标不存在纯 rename；目标为已存在空目录（Windows EPERM 实测触发场景）先清后迁移；rename 不可行时 copy+delete 回退且内容完整
- 结果：通过（3 用例）

### TC-3: bump 幂等标记（W2 / ENF-2）

- 映射需求：delta-specs/single-source-of-truth.md「archive 幂等化」
- 实现：tests/change/archive-idempotency.test.ts（bumpVersionForArchiveIdempotent describe 块）+ tests/change/archive.test.ts「rename AND fallback both failing」用例
- 验证：首次 bump 写 .version-bumped 标记、重放被拦截；bump 失败不写标记可重试；移动彻底失败时无 version.bump audit（bump 严格后置于成功 move）
- 结果：通过

### TC-4: 模块注册判定统一（W3 / ENF-3）

- 映射需求：delta-specs/single-source-of-truth.md「模块注册判定标准统一」
- 实现：tests/guard/registered-module.test.ts
- 验证：isRegisteredSpecModule 四态（prd/tech-only/BOUNDARY-only/无 .mumuspec）；BOUNDARY-only 目录不再触发 index_drift；已注册模块缺 index 条目仍报 drift（回归保护）
- 结果：通过（6 用例）
