# src/rules — Rules Generator

> Generates AI-facing rules files (CLAUDE.md, AGENTS.md, .cursorrules).

## Where to Look

| Task | File | Notes |
|------|------|-------|
| generator.ts | generator.ts | Rules file generation from config + spec context |

## Conventions

- - Generated files are idempotent — re-running produces same output
- - Rules files use marker comments for merge sections

## Anti-Patterns

- - No manual edits to generated rules — use config.yaml instead
