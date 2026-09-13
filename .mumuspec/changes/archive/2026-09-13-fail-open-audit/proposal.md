# Proposal: fail-open-audit

## Why

改进计划 A6：引擎存在一类"执行了动作却没留下可判定事实"的静默吞错点——归档关键路径中，知识提取失败、变更级 spec 合并失败、worktree 清理失败、CHANGELOG 写入失败均被空 catch 吞掉，状态与 audit 仍报 success。与 E-CHANGE-022（delta 合并 fail-closed）同源，但作用于"容错继续"类路径：动作可容错，**事实必须留痕**。

## What

1. **知识提取失败留痕**（archive.ts extractKnowledgeToGlobal）：D1–D4 全部内层 `catch { /* skip */ }` 与外层 `catch { /* Non-fatal */ }` 改为向 extractionLog 注入 `⚠ FAILED → <上下文>: <错误>`；extractionLog 已流入 `knowledge.extract` audit 条目 summary——失败事实借此持久化，无需新增 audit 通道。
2. **变更级 spec 合并失败留痕**（archive.ts mergeChangeLevelSpecs）：prd/tech 两处内层 catch 向 mergeLog 注入失败行；mergeLog 已流入 `change.merge_artifacts` audit。
3. **worktree 清理失败留痕**（archive.ts archiveChange 收尾）：空 catch 改为 `worktree.cleanup` result:'failed' audit 条目。
4. **CHANGELOG 写入失败留痕**（archive.ts recordChangelogEntry）：空 catch 改为 `version.changelog` result:'failed' audit 条目。

**裁决为保持静默的点位**（已在 design 记录理由）：bump marker 写失败（缓存性质，无害）、loop-engine guard 采集失败（C 元层死端另案裁决）、capability 排序锚点跳过（纯展示）、grill-me 变更上下文缺失（可选上下文）。

## Impact Scope

- src/change/archive.ts — 上述四处
- tests/change/archive-branches.test.ts — 失败留痕断言

## Acceptance Criteria

- createKnowledgePage 抛错时，`knowledge.extract` audit 的 summary 含 FAILED 行（不再纯静默）
- 变更级 spec 合并读写失败时，`change.merge_artifacts` audit 含失败行
- 原有"重复页面容错不中断"语义保持（extractionLog 记录但不抛出）
- 三件套不回退，tests/change 相关套件全绿

## Workflow

full
