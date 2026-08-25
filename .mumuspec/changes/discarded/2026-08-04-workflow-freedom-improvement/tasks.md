# Tasks: Workflow LLM Freedom Enhancement

> Execution mode: TDD (Red-Green-Refactor)  
> Parallel groups: [T1] ‖ [T2] → [T3, T4] → [T5, T6] → [T7]

---

## Group A: Path Recommender (P0 — 最高优先级)

### T1: Scope Estimation Core
- [ ] T1.1 Write scope-estimation.test.ts (RED): test `estimateScope` returns correct file/module/API counts
- [ ] T1.2 Implement `src/core/workflow-recommender.ts`: `estimateScope(intent, ctx: ProjectContext): ScopeEstimation`
- [ ] T1.3 Add `ScopeEstimation` type to `src/core/types-workflow.ts`
- [ ] T1.4 Tests pass (GREEN)

### T2: Path Recommendation Engine
- [ ] T2.1 Write recommend-path.test.ts (RED): test `recommendPath(scope)` → `{ path, confidence, rationale }`
- [ ] T2.2 Implement `recommendPath(scope: ScopeEstimation): PathRecommendation`
- [ ] T2.3 Define recommendation rules (tweak/full/hotfix thresholds)
- [ ] T2.4 Tests pass (GREEN)

---

## Group B: Blocking Point Advisor (P1)

### T3: BP Advisor Framework + Resolution Template
- [ ] T3.1 Write bp-advisor.test.ts (RED): test `BPAdvisor.suggest()` returns 2-3 options
- [ ] T3.2 Implement `src/core/bp-advisor.ts`: `BPAdvisor` interface + `BPResolution` type
- [ ] T3.3 Create resolution template with `recommended` flag
- [ ] T3.4 Implement `runAdvisor(bp_id, ctx): BPAdvisorResult`
- [ ] T3.5 Tests pass (GREEN)

### T4: BP-1 ~ BP-18 Advisor Registration
- [ ] T4.1 Create `src/core/bp-advisors/open-bps.ts` (BP-1/2/3 advisors)
- [ ] T4.2 Create `src/core/bp-advisors/design-bps.ts` (BP-4~8 advisors)
- [ ] T4.3 Create `src/core/bp-advisors/build-bps.ts` (BP-9~13 advisors)
- [ ] T4.4 Create `src/core/bp-advisors/verify-bps.ts` (BP-14~16 advisors)
- [ ] T4.5 Create `src/core/bp-advisors/archive-bps.ts` (BP-17 advisor)
- [ ] T4.6 Update guard checker to call advisor at each BP
- [ ] T4.7 Tests pass (GREEN)

---

## Group C: Phase Compression (P2)

### T5: Phase Compressor Core
- [ ] T5.1 Write phase-compressor.test.ts (RED): test `canCompress()` with allowed/denied cases
- [ ] T5.2 Implement `src/core/phase-compressor.ts`: `canCompress(changeState): CompressionResult`
- [ ] T5.3 Add hard safety fence (cross_module / new_api / new_dep / data_migration)
- [ ] T5.4 Tests pass (GREEN)

### T6: Compression Rules + Audit Trail
- [ ] T6.1 Add `compression_rules` section to `workflow.yaml`
- [ ] T6.2 Add `auto_decisions: []` field to `ChangeState` type
- [ ] T6.3 Implement `recordAutoDecision()` helper
- [ ] T6.4 On compress trigger: write entry → `.mumuspec.yaml` + append to `decisions.md`
- [ ] T6.5 Transfer to audit.log on archive
- [ ] T6.6 Tests pass (GREEN)

---

## Group D: Skill Auto-Loading (P3)

### T7: Skill Rule Engine
- [ ] T7.1 Write skill-loader.test.ts (RED): test `computeSkillSet()` with various task characteristics
- [ ] T7.2 Create `src/core/skills/SKILL_RULES.yaml` mapping file
- [ ] T7.3 Implement `src/core/skill-loader.ts`: `computeSkillSet(chars): SkillEntry[]`
- [ ] T7.4 Add invariant: `required_skills ⊆ computed_skill_set`
- [ ] T7.5 Add `SkillRule` / `SkillEntry` types to `types-workflow.ts`
- [ ] T7.6 Tests pass (GREEN)

### T8: CLI Integration — `mumuspec recommend`
- [ ] T8.1 Write recommend-cmd.test.ts (RED): test CLI outputs path recommendation
- [ ] T8.2 Create `src/cli/commands/recommend.ts`
- [ ] T8.3 Add `mumuspec recommend [change]` command to `src/cli/index.ts`
- [ ] T8.4 Output format: path + confidence + rationale + safety_fence_status
- [ ] T8.5 Tests pass (GREEN)

### T9: `mumuspec new` Enhancement
- [ ] T9.1 Write new-cmd.test.ts (RED): test trigger scope estimation on change creation
- [ ] T9.2 Modify `src/cli/commands/run.ts`: `change new` action now calls estimator
- [ ] T9.3 Auto-populate proposal.md with path recommendation
- [ ] T9.4 Tests pass (GREEN)

---

## Group E: Integration + Cross-Cutting

### T10: Workflow YAML Extension
- [ ] T10.1 Add `suggestion:` section with `rules: []`
- [ ] T10.2 Add `compression_rules:` section with conditions
- [ ] T10.3 Add `skill_rules:` section with task-to-skill mapping
- [ ] T10.4 Schema validation passes

### T11: Decision Audit CLI
- [ ] T11.1 Add `mumuspec decisions [change]` command
- [ ] T11.2 Output chronologically formatted decision list
- [ ] T11.3 Filter by phase / decision_type
- [ ] T11.4 Tests pass

### T12: Documentation + Bundles Update
- [ ] T12.1 Update `phase-open.md` — add Step 0 (intent recognition + estimation)
- [ ] T12.2 Update `phase-design.md` — integrate BP advisor flow
- [ ] T12.3 Update `workflow-presets.md` — reference new compression rules
- [ ] T12.4 Update `bundles/mumuspec-skills/mumuspec.md` — document LLM freedom model

---

## Execution Order

```
Phase 1 (MVP, L1):
  T1 → T2 → T3 → T8 → T9 → T10 → T11

Phase 2 (L2):
  T4 → T5 → T6 → T7

Phase 3 (Integration):
  T12 (documentation)
```

## Acceptance Criteria

- [ ] `mumuspec new my-change` 在创建时输出路径推荐 + 理由
- [ ] `mumuspec recommend` 独立命令可复现推荐
- [ ] 变更 ≤2 文件 + 无 API 变更 + 无新依赖时自动压缩为 tweak
- [ ] 压缩决策记录在 decisions.md 中可查
- [ ] 跨模块 / 新 API / 新依赖 永不自主压缩
- [ ] 所有 259 现有单元测试继续通过
- [ ] 新增 30+ 测试覆盖新逻辑
