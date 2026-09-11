# Proposal: spec-lexical-channel-hygiene

## Why

`freedom-metrics-loop-closure` 归档合并后，`mumuspec check` 的 E-GUARD-003 由 59 条升至 68 条。
新增 9 条经逐行核验**全部为误报**，且全部由该变更合入 `spec.md` 的两条 SHALL NOT 触发：

- 4 条命中 `config.constraint_strength` 的**读取**（`constraints.ts:48`、`guard.ts:35`、`spec.ts:311`、
  `knowledge-onboard.ts:18`）——约束语义为"不得被建议逻辑改写"，读取不是改写；
- 1 条命中 `loop.ts:184`，该行是 `console.log('Evaluate with: mumuspec loop evaluate --progress <0-1>')`
  的帮助文案，与收敛语义无关；
- 其余同类命中同理。

根因不在注解引擎的自动映射（`autoAnnotate()` 对这两条返回 `null`），而在**词法兜底通道**：
`src/spec/verifier-classify.ts` 的 R2 规则（`isRegexCheckable` → `extractQuotedTerms`）把约束文本中
行内代码标记内的词一律视为可扫描字面量，`src/guard/checker.ts` 再据此在 `src/` 全量检索该词的**出现**。
两条约束把**对象**（配置键 `constraint_strength`、命令名 `loop evaluate`）写进了行内代码标记，
于是通道退化为"字面量是否出现"，与"是否实施了被禁止的行为"无关——这是既有红线
"禁止自动注解产出与约束语义无关的通道映射"（F8 教训）在**作者侧**的同类失效。

同时暴露一处重复：新约束"自动应用建议——constraint_strength 配置不得被建议逻辑改写"
与既有约束"禁止自动修改 constraint_strength 配置（红线 bp_04 同源）"语义同一，
同一语义存在两条权威源。

## What

1. 删除重复约束，保留既有那条为唯一权威源。
2. 改写"新增命令改变 loop evaluate 收敛语义"一条，去掉承载对象标识符的行内代码标记，
   使其不再派生无关词法通道（该约束的通道是回归测试，不是字面量检索）。
3. 把该纪律写入根规范：约束文本的行内代码标记仅用于约束实际检查的字面量。

## Impact Scope

- `.mumuspec/spec.md`（两条既有约束文本的增删改 + 一条新 Requirement）
- `AGENTS.md`（红线清单随规范重新生成）
- 无 `src/` 代码改动

## Workflow

tweak
