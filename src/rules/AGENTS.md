# src/rules — Rules Generator

> Orchestrates AI-facing rules files (AGENTS.md canonical + CLAUDE.md/GEMINI.md thin shells).
> Content rendering and three-state conflict decisions live in src/install/rules-generator.ts;
> .cursorrules/.windsurfrules are never generated (C3/D2, goal-p0-dispatch-gate).

## Where to Look

| Task | File | Notes |
|------|------|-------|
| generator.ts | generator.ts | Rules file generation from config + spec context |

## Conventions

- - Generated files are idempotent — re-running produces same output
- - Rules files use marker comments for merge sections

## Anti-Patterns

- - No manual edits to generated rules — use config.yaml instead
