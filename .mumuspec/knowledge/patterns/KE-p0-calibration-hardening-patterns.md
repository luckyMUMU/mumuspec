---
id: KE-p0-calibration-hardening-patterns
title: Architecture patterns from p0-calibration-hardening
type: pattern
status: confirmed
scope: p0-calibration-hardening
created_at: 2026-09-07
tags:
  - auto-extracted
  - pattern
  - architecture
  - p0-calibration-hardening
graph_bindings: []
---
> Auto-extracted from p0-calibration-hardening/design.md

# Design: p0-calibration-hardening

> 变更来源：`review/spec-code-calibration-2026-09-05.md` P0 清单（TEMP 与 GLOSSARY 两项已由 doc-governance-decisions 消解）。
> 本文档将 proposal 的 4 项 P0 细化为可实现的层级设计，作为 build 阶段蓝图。
> 范围决策（用户已签收，grill-me BP）：P0-A 最小版；P0-B 用 max_layer_depth；逐步推进+BP 确认。

## 0. 设计目标与原则

收敛 spec 硬性 SHALL 与代码实现的差距，使规范链对代码的约束声明不再失真。坚持：
- **Ponytail**：最小可工作实现，无未请求抽象。
- **规则-实现分离（KP-0060）**：确定性逻辑归代码，校验失败拒绝执行（fail-closed）。
- 不破坏既有 CLI/API 契约（向后兼容）。

## 1. 分层计划（自底向上）

| 层 | scope | 内容 |
|----|-------|------|
| L0 | loader 层数 | P0-B：selectLayersToLoad 使用 max_layer_depth |
| L1 | rules 容量断言 | P0-C：rules-generator 产物 ≤ 32KiB |
| L2 | capability 元数据 | P0-A：CommandMetadata + `mumuspec capability` |
| L3 | finalize-archive | P0-D：原子性/回滚、code-graph snapshot、cache 删除、防重跑 |

## 2. P0-B — loader 层数配置化（L0）

### 问题
`src/spec/loader.ts:358-376` `selectLayersToLoad(chain, _maxDepth)` 忽略 `_maxDepth`，硬编码 3 层。违反 spec「SHALL NOT hardcode a fixed number of layers」。

### 决策
- 采纳配置 `config.specs.max_layer_depth`（默认 5，`config-io.ts:18`）。
- 语义：渐进式披露优先保留 root（level 0）+ target（最深），中间层**最多取 (max_layer_depth − 2)** 个；当实际含 spec 层数 ≤ max_layer_depth 时全量返回，超出时做降载。

### 设计
```ts
// 伪码
function selectLayersToLoad(chain, maxDepth): layers {
  const withSpecs = chain.filter(c => hasMumuspec(c));
  if (maxDepth <= 0) maxDepth = DEFAULT_LAYER_DEPTH; // 防御非法配置
  if (withSpecs.length <= maxDepth) return withSpecs;
  // 保 root + target，中间层截断以尊重 maxDepth 上限
  const root = withSpecs[0];
  const target = withSpecs[withSpecs.length - 1];
  const keep = maxDepth - 2;
  const middle = withSpecs.slice(1, -1);
  const capped = middle.length <= keep ? middle : middle.slice(middle.length - keep);
  return [root, ...capped, target];
}
```
> 注：`_maxDepth` 改为 `maxDepth`；`config.specs.max_layer_depth` 已由调用方传入（loader.ts:41）。修正命名即消除未使用参数。

### Enforcement
- ENF-B1（test）：depth=3、5、10 下行为断言（全量返回 vs 降载保根+目标）。
- ENF-B2（test）：非法/缺失配置回退默认 5。

### 风险
- 既有行为是"3 层"，默认配置 5 层会加载更多 context，token 略增。可接受（对齐 spec 承诺）。

## 3. P0-C — Rules 产物 32KiB 