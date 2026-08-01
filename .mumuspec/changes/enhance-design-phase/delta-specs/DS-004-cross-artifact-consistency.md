---
title: Cross-Artifact Consistency Check
id: DS-004
scope: src/guard/phase-guard.ts
status: proposed
priority: P1
---

# Delta Spec: 跨工件一致性检查

## Current Behavior
无跨工件校验，design.md 与 proposal.md 可能不一致。

## New Behavior
guard --apply 在 checkDesignToBuild 中增加一致性检查。

## Check Rules
1. Plan Coverage: proposal.Plan 每个步骤在 design.Layers 中有对应
2. FR Satisfaction: proposal 每个 FR 在 design 中被满足
3. Risk Coverage: cognitive-map Q4 risk 在 mitigation 中有对应
4. Delta-Spec Alignment: delta-specs 文件路径在 Layers 中出现

## Error Code
- E-DESIGN-010: 跨工件不一致，附上差异详情
