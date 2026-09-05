# Proposal: Workflow LLM Freedom Enhancement

## Summary

Enhance the MumuSpec workflow engine to give the LLM dynamic decision-making freedom — moving from a purely static phase-execution model (L0) toward an orchestrator role (L1~L3). This reduces unnecessary process overhead for simple changes while preserving guard-rails for complex ones.

## Problem

1. **Static dispatch** — Every change follows the same 5-phase flow regardless of size or risk.
2. **Single-thread execution** — No capacity for parallel exploration or multi-perspective design comparison.
3. **Decision outsourced to user** — The LLM cannot recommend or auto-select workflow paths based on task characteristics.

## Goals

| ID | Goal | Success Metric |
|----|------|---------------|
| G1 | LLM recommends workflow path with reasoning at Open stage | Path suggestion appears in proposal.md |
| G2 | LLM proposes 2-3 resolution options when blocking points fire | BP resolution section has ≥2 alternatives |
| G3 | LLM auto-compresses stages within safety fence (tweak-scale only) | Changes ≤2 files skip Design without user prompt |
| G4 | Skills dynamically loaded based on task context | Skill list varies per change |

## Scope

### In Scope

- Workflow YAML suggestion rules
- Blocking Point auto-suggestion logic
- Phase compression conditions
- Skill auto-loading
- Decision audit trail

### Out of Scope

- Full L3 sub-agent orchestration (deferred to Phase 2)
- Red/Blue adversarial verification (deferred to Phase 2)
- Changes to guard checker logic

## Risk

| Risk | Mitigation |
|------|-----------|
| LLM over-aggressively compresses phases | Hard safety fence: cross-module / new API / new dependency always forces full workflow |
| Audit log grows unbounded | Decisions auto-pruned after archive |

## Non-Goals

- Not replacing the 5-phase model, only augmenting it
- Not removing any blocking points, only enriching how they are resolved
