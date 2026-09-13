# Design: drift-delta-preview

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

复用 delta-channels 的解析面抽出条目枚举函数，drift --change 渲染 diff 预览——先校验器后消费者（枚举函数与门禁同源，不产生第二份解析实现）。

## 实现

### D1: delta-channels.ts 重构

```ts
export interface CarriedItem {
  file: string;            // 'constraints/new-shall.md'
  requirement: string;
  polarity: 'shall' | 'shall-not';
  text: string;
}
export function listCarriedConstraintItems(changeDir: string): CarriedItem[];
```

- `collectUnchanneledDeltaConstraints` 改为：listCarriedConstraintItems + classifyBlockItem 过滤（把 UnchanneledItem 所需 reason 一并保留——分类函数签名调整 CarriedItem→含 requirement）。
- 行为零变化（现有 303 测试回归佐证）。

### D2: drift --change 渲染（spec.ts runDriftDetection）

`options.change` 分支、漂移发现输出之后：

```
Delta 预览（归档将并入主规范）:
  + [shall] 所有操作必须记录审计日志  ← constraints/new-shall.md
  + [shall-not] 禁止随机跳过缓存失效  ← delta-specs/cache-tech.md
```

- 条目来源 `listCarriedConstraintItems(getChangeDir(root, options.change, state.scope))`。
- 空数组 → `（无携带约束）`。

### 不做什么

- 不做逐字符 diff（约束条目为增量语义，+ 行已足够）；不动 --full 报告。

## 测试用例

1. TC1 listCarriedConstraintItems：constraints + delta-specs 两文件条目枚举，字段齐备。
2. TC2 collectUnchanneledDeltaConstraints 回归不变（既有 4 例继续绿）。
