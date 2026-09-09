---
id: KE-2026-09-09-review-followup-hardening-patterns
title: Architecture patterns from 2026-09-09-review-followup-hardening
type: pattern
status: confirmed
scope: 2026-09-09-review-followup-hardening
created_at: 2026-09-09
tags:
  - auto-extracted
  - pattern
  - architecture
  - 2026-09-09-review-followup-hardening
graph_bindings: []
---
> Auto-extracted from 2026-09-09-review-followup-hardening/design.md

# Design: 2026-09-09-review-followup-hardening

## 总体

三个独立工作流，共享"单一真相"主题，均可独立测试与回滚。

## W1 权重单一权威源

### 现状
- `DEFAULT_EVALUATOR_WEIGHTS`（types.ts L121）唯一消费者是本 CHG 前写的测试 `freedom-suggestions.test.ts`；src 生产路径零消费。
- 权威源 = 各 evaluator `defaultWeight`，经 `MetricResult.weight` 在 auto-evaluate 消费（L90-107 运行时归一化）。

### 方案
1. 删除 types.ts 中 `DEFAULT_EVALUATOR_WEIGHTS` 及其注释块。
2. 重写 `freedom-suggestions.test.ts` 中引用 map 的用例 → 改为**注册表不变量测试**：`registerBuiltInEvaluators()` 后遍历 `getActiveEvaluators()`：
   - `defaultWeight > 0` 的权重和 = 1（容差 1e-9）；
   - `constraint-density` 存在且 defaultWeight = 0（调节信号，D1 契约）。
3. 不新增动态推导机制（评估器集合可变，动态 map 无稳定语义）。

## W2 archive 幂等化（src/change/archive.ts）

### 现状（问题序列）
1. `bumpVersionForArchive`（写 package.json + src/cli.ts 版本 + CHANGELOG）在 rename **前**执行；
2. Windows `renameSync` EPERM → audit 记 failed + throw E-CHANGE-011；
3. 用户重试 → bump 再次执行 → 版本连跳（本次实测 0.20→0.23）。
- mergeDeltaSpecsToMain（marker 幂等）与 extractKnowledgeToGlobal（按变更名键控）retry 安全，无需移动。

### 方案
1. **新增 `moveDirSync(from, to)`**（archive.ts 内部）：
   - 优先 `renameSync`；
   - 捕获 EPERM/EACCES/EXDEV → `cpSync(from, to, { recursive: true })` + `rmSync(from, { recursive: true, force: true })`；
   - 两段均失败才向上抛（保持现有 audit failed + E-CHANGE-011 语义）。
2. **bump 后置**：`bumpVersionForArchive` 调用移到 rename 成功之后、audit success 之前；merge/extract 保持原位（retry 安全）。
3. **bump 幂等标记**：归档目录 `.mumuspec/.version-bumped`（内容 = 已 bump 版本号）。bump 前检查标记存在则跳过并返回 null；bump 成功后写入标记。防双调用/手动重放。
4. saveChangeState 保持 rename 后（现状），路径解析不变。

### 失败矩阵
| 失败点 | 状态 | 重试结果 |
|---|---|---|
| rename 前（merge/extract） | 可重入，幂等 | 安全重试 |
| rename（含回退） | 无副作用已发生 | 安全重试（本次 bug 消除）|
| rename 后、bump 前 | dir 已归档、phase 未存 | state check 拦截；版本未动 |
| bump 后、state 保存前 | 标记已写 | 重放 bump 被标记拦截 |

## W3 模块注册判定统一

### 现状
- checker（guard/checker.ts G7b `collectSpecDirsRel`）：只看 `.mumuspec` 存在 → BOUNDARY-only 目录被计入 → 与 builder 判定冲突。
- builder（finalize-archive.ts `rebuildIndexYaml`）：`.mumuspec` + (prd.md || tech.md)。

### 方案
1. 新增共享判定 `isRegisteredSpecModule(dir): boolean