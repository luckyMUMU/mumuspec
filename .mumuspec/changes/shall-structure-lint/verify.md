# Verify: shall-structure-lint

## verify_result

pass

## 测试证据

- 单元 + 集成：`vitest run tests/spec/structure-lint.test.ts tests/spec/verifier-strict.test.ts tests/spec/verifier-classify.test.ts` → 3 files / **38 tests passed**。
  - TC1：7 个词表词逐一命中。
  - TC2：干净文本返回 null；多命中去重且按词表序（合理→适当→必要时）。
  - TC3：SHALL 含"合理" → W-SPEC-016 一条，message 含 Requirement 名与命中词，detail 含 `[命中: 合理]`；advisory 不影响 passed。
  - TC4：SHALL NOT 含"酌情"触发；同文件干净 Requirement 零告警。
- 构建产物：`npm run build` 零 TS 错误；`gen-error-codes-doc` 再生（111 码 / 20 域，W-SPEC-016 可见）。
- 真实语料噪音率：本仓库 327 条约束 validate **W-SPEC-016 命中 0 条**——词表保守性达标（设计决策点"先 advisory 观察噪音率"的首个数据点）。
- 自检三件套：`mumuspec check` exit 0 / `mumuspec validate` ✓（0 error）/ `npm run ci:check` ✅（含 Check 4 双门全绿）。

## 人工验证证据

- 结构检查器与分类器正交：W-SPEC-016 只看文本特征，不改四分类判定与 coverage 统计（verifier-classify 零改动，回归 38/38 佐证）。
- 消费者闭环：structure-lint.ts 唯一消费者为 validator.ts（同批交付），无死端产出。

## 验收标准对照（proposal Acceptance Criteria）

1. 含无界词约束 → W-SPEC-016（含命中词）✓（TC3/TC4）
2. 干净约束零告警；SHOULD 不检查 ✓（classifyRequirements 只收集 SHALL/SHALL NOT，TC2）
3. ERROR_CODES 注册文档可见（110→111）✓（build 输出再生成功）
4. 三件套不回退，目标测试全绿 ✓
