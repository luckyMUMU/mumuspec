---
id: KE-enforcement-gap-patterns
title: Architecture patterns from enforcement-gap
type: pattern
status: confirmed
scope: enforcement-gap
created_at: 2026-09-19
tags:
  - auto-extracted
  - pattern
  - architecture
  - enforcement-gap
graph_bindings: []
---
> Auto-extracted from enforcement-gap/design.md

# Design: enforcement-gap

## 概述
补两个基准可信度缺口：constraints.yaml 机读注解通道（含执行面接线），与 STATUS 文档断言对账通道。全部判定为确定性代码推导，不新增引擎、不改既有 JSON schema 结构。

## L1 constraints.yaml 注解通道

### 数据形状
`ConstraintEntry`（src/core/types-constraint.ts:35）追加可选字段：
```ts
annotation?: MachineReadableAnnotation;  // 复用 spec frontmatter 注解同一类型
```
向后兼容：字段缺省时行为与现状逐字节一致。

### 分类判定序（与 spec 条目同标准）
`classifyConstraintEntry`（src/spec/verifier-classify.ts:277）重写为：
1. R1：`entry.annotation` 存在且 `type !== 'custom'` → `enforced-strong`
2. R2：content 以 `lex:` 前缀开头 → `enforced-weak`；无显式前缀时仅当 `legacy_lexical_channel`（默认 true）开启且 `isRegexCheckable` → `enforced-weak`
3. R3：`enforcement` 非空 → `manual`（legacy 自由文本 = implicit-manual）
4. R4：其余 → `unverifiable`

新可选入参 `opts?: ClassificationOpts` 传入 `legacyLexical`；既有调用方不传保持默认。

### 执行面接线（消费者同批交付）
新纯函数 `constraintEntryToItem(entry, direction): ClassifiedItem`（verifier-classify.ts 导出），投影进 `guard/checker.ts`：
- enforced-strong 条目并入 `checkShallEnforcement` 的 items 流水线（复用 E-GUARD-012 语义，reverse 方向按 SHALL NOT 违规消息）。
- coverage 计算（`computeEnforcementCoverage`）输入合入投影 items，使五桶数值含 constraints.yaml 条目。
- 条目 source 字段 = `.mumuspec/constraints.yaml#<id>`（或子树文件路径），用于 `isFileInScope` 界定检查范围。

### annotate 辅助
`mumuspec annotate` 输出追加 constraints.yaml 条目的**建议清单**（复用 `autoAnnotate`/KNOWN_PATTERNS），只读展示、不回写（F8 错配纪律 + 人工签收）。

## L2 status-assertion 对账通道

### 新模块 `src/guard/status-assertion-checker.ts`
纯函数 `checkStatusAssertions(root, facts): DriftEntry[]`；输入 = STATUS.md 文本 + 注入的仓库事实 `{version, commandCount, toolCount, moduleStats}`。事实采集在 checker 侧装配（in-process：CLI 注册表计数、MCP 工具注册计数、`src/<module>/` 生产代码行数、package.json 版本），不把 IO 放进纯函数。

对账子集（只拦"断言与事实矛盾"）：
| 断言 | 事实源 | 矛盾判据 |
|---|---|---|
| 当前包版本 X | package.json version | X ≠ 实际 |
| 能力层进度表"实现进度 0%"（有映射目录） | src/<module> 生产行数 | 行数 ≥ 200 |
| 能力层进度表 ">0%"（有映射目录） | 同上 | 目录不存在或行数 = 0 |
| "N+ 命令可用" | CLI 注册表命令数 | 实际 < N |
| "N+ 工具可用" | MCP 工具注册数 | 实际 < N |
| 最后更新日期 | 距今天数 | > 30 天（info 级 WARN） |

模块名→目录映射为常量表（机械、不动态推导——对齐"不引入运行时动态注册推导"红线）。无映射的行（认知框架/