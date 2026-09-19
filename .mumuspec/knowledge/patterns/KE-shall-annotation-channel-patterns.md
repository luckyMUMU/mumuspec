---
id: KE-shall-annotation-channel-patterns
title: Architecture patterns from shall-annotation-channel
type: pattern
status: confirmed
scope: shall-annotation-channel
created_at: 2026-09-18
tags:
  - auto-extracted
  - pattern
  - architecture
  - shall-annotation-channel
graph_bindings: []
---
> Auto-extracted from shall-annotation-channel/design.md

# Design: shall-annotation-channel

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

为 SHALL 约束开放机器可执行通道：R1 判定（注解/`ast:` → enforced-strong）对极性中立，SHALL 复用既有 annotation→AST 执行链路（checkAstViolation），guard 执行注解对应检查并在命中时报新错误码 E-GUARD-012。不给 SHALL 引入词法 weak 层（enforced-weak 保留给 SHALL NOT 兜底），不新增引擎，不改变无通道约束的 E-SPEC-004/015 判定。

## 实现

### 1. 分类对称（src/spec/verifier-classify.ts）

- `classifyConstraint`：R1 判定提升为极性中立——注解命中（`annotation.type !== 'custom'`）或文本以 `ast:` 开头 → `enforced-strong`（对 shall 与 shall-not 一律生效）。`isRegexCheckable`（R2）仍仅对 shall-not 执行，SHALL 不进入词法兜底。无通道 SHALL 仍回落 unverifiable。
- `ClassifiedItem` 新增可选字段 `annotation?: MachineReadableAnnotation`：`makeItem` 在命中注解时带入（复用分类内同一切词查找 `annotations.find(a => a.text === c.text)`，不重复查找）。

### 2. checkShall 驱动化（src/guard/checker.ts）

- `checkCompliance`：将已单次计算的 `sourceFiles` 传入 `checkShall`（沿用 L116-117 的 IO 复用语义）。
- `checkShall` 新增执行段：对 `item.cls === 'enforced-strong' && item.polarity === 'shall' && item.annotation` 的条目，遍历范围内源文件：
  - 调用 `checkAstViolation(content, item.text, filePath, item.annotation)`（复用 L598-653；annotation 驱动时无 regex 兜底，L667-670 语义）；
  - 命中 → `errors.push({ code: 'E-GUARD-012', message: \`SHALL 未满足: ${item.text}\`, detail: \`${filePath}:${line} (source: ${item.source})\` })`。
- 执行语义沿用 checkShallNot：跳过测试文件，agent-behavior 豁免，`isFileInScope` 范围过滤。
- `typeToConstraint` 映射（L609-616）提取为模块级共享常量，`checkAstViolation` 消费同源映射（防 checker 内复制漂移）。

### 3. 错误码

- `src/core/errors.ts` 新增 `E-GUARD-012`（guard 域，`SHALL_NOT_SATISFIED`）：SHALL 约束机器检查命中（要求未被满足）。注册 ERROR_CODES 后经 `npm run gen:error-codes` 同步错误码文档。

### 4. 无改动面

- `parser.ts` 零改动：注解复用既有 frontmatter `prohibitions:` 机制，按精确文本匹配（ProhibitionAnnotation.text 与 SHALL 条目文本一致即绑定）；不新增 frontmatter 键。
- `checkShallNot` 零改动：SHALL NOT 通道行为不变（R2 反转与 `lex:` 前缀属下一变更）。
- `delta-channels.ts` / 评估器 / loop 语义零改动。

## 错误码

- 新增 `E-GUARD-012`（guard 域）：`SHALL_NOT_SATISFIED`——SHALL 约束机器检查命中（要求未被满足）。注册于 src/core/errors.ts。

## 不做什么

- 不给 SHALL 引入词法 weak 层（enforced-weak 语义保留给 SHALL NO