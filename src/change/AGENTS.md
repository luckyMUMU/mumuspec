# src/change — Change Lifecycle & State Machine

> 5-phase change lifecycle (Open → Design → Build → Verify → Archive) with state machine enforcement and idempotent artifact merging.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Phase transitions | `state-machine.ts` | Valid transitions, rollback/rebuild limits |
| Change persistence | `manager.ts` / `state.ts` | Load/save change state, list active changes |
| Archive & merge | `archive.ts` | Version bump, delta-spec merge, artifact merge, knowledge extraction |
| Branch lifecycle | `branch.ts` | Branch creation, commit, merge gate |

## Key Concepts

- **Phases**: `open` → `design` → `build` → `verify` → `archive`
- **Workflows**: `full`, `hotfix`, `tweak` (preset paths that skip Design)
- **State fields**: `phase`, `workflow`, `build_layers`, `rollback_count`, `rebuild_count`, `test_cases_locked`
- **Rollback/Rebuild limits**: Enforced by state machine to prevent infinite loops
- **Test case locking**: Tests locked after Design phase — immutable in Build
- **Idempotent archive merge**: `mergeChangeArtifacts` uses Marker comments to ensure repeated archive operations don't duplicate content

## Conventions

- State stored in `.mumuspec/changes/<name>/.mumuspec.yaml`
- All state transitions go through `getValidTransitions()` — never bypass
- Archive moves to `.mumuspec/changes/archive/`

## Anti-Patterns

- **No direct state mutation**: Always use `manager.ts` functions
- **No skipping phases**: Transitions must follow state machine rules
- **No modifying locked tests**: Design-locked test cases are immutable
- **No duplicate merges**: Archive merge uses Marker comments for idempotency — never merge the same artifact twice
