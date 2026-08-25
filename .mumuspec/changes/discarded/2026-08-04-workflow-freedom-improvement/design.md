# Design: Workflow LLM Freedom Enhancement

## Architecture

### Current Architecture (Static Pipeline)

```
User Intent → workflow.yaml static dispatch → Phase chain → Done
```

### Target Architecture (Dynamic Orchestration)

```
User Intent
    ↓
Step 0: LLM Intent Recognition + Scale Estimation
    │  - Analyze scope (files, modules, APIs, deps)
    │  - Compute risk tier
    ↓
Step 1: Path Recommendation (L1)
    │  - Suggest full / tweak / hotfix with rationale
    │  - User confirms (or auto-accepts within L2 rules)
    ↓
Step 2: Workflow Assembly
    │  - Load phase-specific skills (dynamic)
    │  - Apply phase compression if conditions met
    ↓
Phase Execution with Enhanced Blocking Points
    │  - Each BP: LLM proposes 2-3 resolution options
    │  - Decision logged to decisions.md
    ↓
Done
```

## Key Components

### 1. Path Recommender (P0)

**Input**: User intent + codebase scan
**Output**: Recommended workflow (full/tweak/hotfix) + confidence + rationale

Evaluation dimensions:
- `estimated_files`: count of files likely to be changed
- `cross_module`: whether change touches multiple modules
- `new_public_api`: whether new public interfaces introduced
- `new_external_dep`: whether new npm/pip packages needed
- `risk_level`: inferred from code criticality

### 2. Blocking Point Advisor (P1)

Each blocking point (BP-1 ~ BP-18) gets an `Advisor` function:

```typescript
interface BPAdvisor {
  bp_id: string;
  analyze: (ctx: PhaseContext) => BPAnalysis;
  suggest: (analysis: BPAnalysis) => BPRecommendation[];
  autoResolve?: (recommendation: BPRecommendation) => boolean;
}
```

Output format:
```
## BP-N: [Title]
Status: BLOCKED

### Analysis
[Why this point is currently blocked]

### Options
1. **[Recommended]** [Option A] — [rationale]
2. [Option B] — [rationale]
3. [Option C] — [trade-off]

Awaiting user choice...
```

### 3. Phase Compressor (P2)

Based on classification at Open stage:

| Condition | Action |
|-----------|--------|
| `estimated_files <= 2` AND `no_api_change` AND `no_new_dep` | Auto-compress to tweak |
| `is_doc_only == true` | Skip TDD red-green loops |
| `is_pure_bugfix == true` AND `root_cause_confirmed == true` | Start from RED test |

Safety fence (NEVER compress):
- `cross_module == true`
- `new_public_api == true`
- `new_external_dep == true`
- `data_migration == true`

### 4. Skill Auto-Loader (P3)

Maps task characteristics → required skills:

```yaml
skill_rules:
  - when: "involves_concurrency"
    load: [concurrency-patterns, thread-safety]
  - when: "involves_new_dependency"
    load: [dependency-management, license-check]
  - when: "involves_api_change"
    load: [api-design, versioning-strategy]
  - when: "involves_database_schema"
    load: [migration-patterns, data-integrity]
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Change Creation (mumuspec new)                              │
│  ├── LLM generates proposal.md                              │
│  ├── LLM runs path recommender                             │
│  ├── User confirms recommended path                        │
│  └── LLM generates design.md + delta-specs/                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase Execution                                             │
│  ├── Load workflow.yaml for phase                           │
│  ├── Compress phases if conditions met (L2)                 │
│  ├── Load dynamic skill set                                 │
│  ├── At each BP: advise + log decision                      │
│  └── On completion: transition to next phase                │
└─────────────────────────────────────────────────────────────┘
```

## Decision Audit Trail

All autonomous decisions are written to `.mumuspec.yaml` under `auto_decisions`:

```yaml
auto_decisions:
  - timestamp: "2026-08-02T10:00:00Z"
    phase: open
    decision: auto_compress_to_tweak
    rationale: "1 file changed, no API change, no new dep"
    confidence: high
    approved_by: auto_L2_rule
  - timestamp: "2026-08-02T10:05:00Z"
    phase: design
    decision: bp_4_alternative_selected
    alternative: 1
    rationale: "Recommended approach uses existing pattern"
    approved_by: user
```
