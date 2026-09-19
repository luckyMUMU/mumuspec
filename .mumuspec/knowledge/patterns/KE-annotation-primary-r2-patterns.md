---
id: KE-annotation-primary-r2-patterns
title: Architecture patterns from annotation-primary-r2
type: pattern
status: confirmed
scope: annotation-primary-r2
created_at: 2026-09-18
tags:
  - auto-extracted
  - pattern
  - architecture
  - annotation-primary-r2
graph_bindings: []
---
> Auto-extracted from annotation-primary-r2/design.md

# Design: annotation-primary-r2

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

把 SHALL NOT 的 enforced-weak 通道从"无注解自动兜底"改为显式 opt-in：`lex:` 前缀直通，或 `specs.legacy_lexical_channel=true`（兼容期）保留旧行为。新配置键默认 `true`，首版行为与现状逐字节一致；翻转后无注解无前缀文本回落 unverifiable，经 E-SPEC-015 出口三分法引导修复。注解/AST（R1）成为机器通道唯一主入口。

## 实现

### 1. 配置键（src/core/config-io.ts / config.ts / migrations）

- `config.specs.legacy_lexical_channel: boolean`，新增字段。
- config-io.ts 默认值 `true`（兼容期首版行为不变）。
- config.ts `SpecsConfig` 类型追加可选字段；migrations.ts 缺省兼容（旧配置无此键 → 按默认 true）。

### 2. 分类策略（src/spec/verifier-classify.ts）

- `classifyConstraint(c, opts?: { legacyLexical?: boolean })`（可选参数默认 `true`，调用方显式传配置值）：
  - R1 不变（注解/`ast:` 极性中立，A1 语义）。
  - R2 门控改为：`text` 以 `lex:` 前缀开头 → `enforced-weak`（显式入口，无条件）；否则仅当 `polarity==='shall-not' && interests.opts.legacyLexical !== false && isRegexCheckable(text)` → `enforced-weak`。
  - 其余回落（R3 manual / R4 unverifiable 顺序不变）。
- `classifyRequirements` 增加可选 `opts` 透传。
- `ClassifiedItem` 增加 `weakSource?: 'lex' | 'legacy'`：R2 命中时记录来源（供覆盖报告区分行动项）。

### 3. 调用方接线（src/guard/checker.ts / src/spec/validator.ts）

- `checkCompliance` / `checkShallNot` / `checkShall` 与 validator 的 `emitVerifiabilityFindings` 从 `loadConfig()` 读取 `config.specs?.legacy_lexical_channel`，显式传入 classify。
- 无配置对象或键缺失 → 按 true（向后兼容路径，行为与现状一致）。

### 4. 覆盖报告（src/spec/verifier-classify.ts computeEnforcementCoverage）

- 新增字段：`legacy_weak: number`（weakSource==='legacy' 的条目数）与追加详情数组 `actionable_weak: Array<{requirement, text, source}>`——"需补注解"行动项。
- `unverifiable_items` 既有字段与语义零改动（不清零、不改写）。

### 5. 文档与审计

- docs/reference/configuration.md 增补新键说明。
- 错误码不变（E-SPEC-015 复用既有出口；check/validate JSON schema 仅追加字段）。

## 错误码

- 无新增错误码。E-SPEC-015 语义扩展"可操作出口"文案（新增 `lex:` 前缀与 legacy 键引导），注册于 src/core/errors.ts 的既有项。

## 不做什么

- 不改变 `legacy_lexical_channel=true` 时的既有 R2 行为（兼容面零变化）。
- 不引入新引擎/新 annotation 类型（no-new-engines 契约）。
- 不改 `isRegexCheckable` 的判定语义（仅延后为显式/legacy 触发）。
- 不加交互式迁移向导（迁移走只读报告 + config 手动签收）。

## 测试用例

详见 `test-cases/l