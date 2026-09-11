# Proposal: archive-prune-safety

## Why

`finalize-archive` 的缓存清理步骤按目录 mtime 递归删除 `changes/archive/` 下的归档变更目录。
该步骤名为缓存清理，实际删除的是归档变更目录本身——delta-specs、decisions.md、design.md、
cognitive-map.yaml 的唯一物理副本，且 `discarded/` 同样在删除范围内。
执行过程无人工确认、无路径级审计记录，输出仅报告清理条目数。

判定依据是目录 mtime，与归档时间无因果关系，会被 git 操作等非归档行为刷新或推迟，
因此该删除行为在短期内不触发、在不可预测的时间点批量生效。

## What

移除归档目录的删除行为，改为只读报告：输出陈旧归档条目清单与建议的处理方式，
不执行任何删除。归档目录的生命周期不再由 `finalize-archive` 决定。

## Impact Scope

- `src/cli/commands/finalize-archive.ts`

## Workflow
hotfix

## Workflow Path Recommendation

**Recommended Path:** hotfix
**Confidence:** 80%

**Rationale:**
Pure bugfix with confirmed root cause and low risk. Hotfix path appropriate.

> L1 Suggestion mode — awaiting user confirmation before proceeding.
