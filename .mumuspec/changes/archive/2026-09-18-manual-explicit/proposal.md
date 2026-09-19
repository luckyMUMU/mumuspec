# Proposal: manual-explicit

## Why

manual 目前是"懒惰默认"：任何 block-level enforcement 即 manual（src/spec/verifier-classify.ts classifyConstraint R3），`implicit-manual`（legacy 自由文本）与显式 `manual(reason)` 无法在 validate 层区分提示；constraints.yaml 条目分类（classifyConstraintEntry）恒 manual/unverifiable，脱离统一通道。manual verify 证据用"包含 enforcementId / 前 24 字符"字符串锚点（missingManualEvidence），可被误匹配且不可机器校验。

## What

1. `implicit-manual` 迁移提示：validate 对 `kind === 'implicit-manual'` 的 enforcement 报 `W-SPEC-017`（advisory），指引改写为显式 `manual(reason)`；不改变既有分类（manual 类不变）与阻断语义。
2. 证据匹配升级：`missingManualEvidence` 支持结构化证据记录 `{constraintId, user, verdict, timestamp, evidence_hash}`——命中记录则结构校验 + 按 id 匹配；无结构化记录时回落既有文本锚点匹配（向后兼容，现有 verify.md 不受影响）。`evidence_hash` 由写入方经 computeHash 计算（hash 类字段纪律：禁 LLM/手写），解析器仅验证结构。
3. `classifyConstraintEntry` 接入统一通道：enforcement 为空时按 `isRegexCheckable(content)` 判 enforced-weak，否则 unverifiable；`manual(...)` 声明才为 manual；其余文本仍 manual（implicit，行为不变）。

## Impact Scope

- .

## User Decisions

- 无阻塞项（本变更不改变既有分类结果、不改变阻断语义、不改变 check/validate 既有 JSON schema；新增 advisory 警告与解析器仅追加）

## Workflow

full