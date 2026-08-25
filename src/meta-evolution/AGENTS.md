# src/meta-evolution — Meta-Evolution Engine

> Effectiveness scoring, impact analysis, knowledge evolution, and skill recommendation.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| index.ts | index.ts | Barrel re-export (R-0005) |
| impact-analysis.ts | impact-analysis.ts | Pre-apply analysis: files modified, breaking changes |
| knowledge-evolution.ts | knowledge-evolution.ts | Knowledge page usage analysis and freshness tuning |
| scoring.ts | scoring.ts | Effectiveness scoring: pass rate, false positive rate |
| skill-recommender.ts | skill-recommender.ts | Skill recommendation based on project scope |
| stats.ts | stats.ts | Statistics persistence to stats.jsonl |
| types.ts | types.ts | Data models for scoring, evolution, recommendations |

## Conventions

- - All metrics persisted to .mumuspec/evolution/stats.jsonl
- - Scoring is non-blocking — runs as background analysis

## Anti-Patterns

- - No evolution changes without user confirmation
