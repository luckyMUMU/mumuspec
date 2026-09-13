---
id: KE-fail-open-audit-patterns
title: Architecture patterns from fail-open-audit
type: pattern
status: confirmed
scope: fail-open-audit
created_at: 2026-09-13
tags:
  - auto-extracted
  - pattern
  - architecture
  - fail-open-audit
graph_bindings: []
---
> Auto-extracted from fail-open-audit/design.md

# Design: fail-open-audit

<!-- no-open-questions -->
<!-- no-assumptions -->

## 设计原则

容错路径的失败不中断流程（保持现有可用性），但**事实必须流入既有 audit 通道**——复用 extractionLog / mergeLog 两个既有汇聚点，不新增 audit 动作类型，最小面改造。

## G1: extractKnowledgeToGlobal 失败留痕

- D1 Q1/Q3/Q4、D2、D3、D4 的内层 `catch { /* skip */ }` →
  `catch (err) { extractionLog.push('  ⚠ FAILED → <来源>: ' + (err as Error).message); }`
- D1/D2/D3 外层 `catch { /* Non-fatal */ }`（读取 cognitive-map/decisions/design 失败）→ 同上，来源标注 `D1 认知图读取` / `D2 decisions 读取` / `D3 design 读取`。
- audit 写出条件不变（extractionLog.length > 0）；result 枚举不动（success/no-content），失败明细由 summary 的 FAILED 行承载——避免扩大 result 枚举的消费者面。

## G2: mergeChangeLevelSpecs 失败留痕

- prd/tech 两处内层 catch → `mergeLog.push('⚠ .mumuspec/prd.md 合并失败: ' + err.message)`（tech 同构）。
- mergeLog 已由 mergeChangeArtifacts 汇入 `change.merge_artifacts` audit。

## G3: archiveChange 收尾 worktree 清理失败留痕

- 空 catch → `appendAuditLog({ action: 'worktree.cleanup', change, result: 'failed', error })`。

## G4: recordChangelogEntry 失败留痕

- 空 catch → `appendAuditLog({ action: 'version.changelog', change, result: 'failed', error })`。

## 裁决保持静默（记录理由）

| 点位 | 理由 |
|---|---|
| bump marker 写失败（archive.ts:361） | 标记仅为缓存去重，失败无害且下次幂等重试 |
| loop-engine guard 采集失败 | C 元层死端另案裁决（改进计划观察项） |
| capability 排序锚点跳过 | 纯展示排序，无事实损失 |
| grill-me 变更上下文缺失 | 可选上下文，缺失即降级行为本身 |

## 测试用例

1. TC1 createKnowledgePage 全部抛错（仅 D2 存在）→ `knowledge.extract` audit 被调用且 summary 含 FAILED。
2. TC2 createKnowledgePage 部分成功部分失败 → audit summary 同时含成功行与 FAILED 行，pages_created 只计成功。
3. TC3 mergeChangeArtifacts 中目标不可读 → `change.merge_artifacts` audit summary 含失败行。
4. TC4 原有容错语义回归：重复页面不抛出（archive-branches.test.ts 既有断言保持绿）。
