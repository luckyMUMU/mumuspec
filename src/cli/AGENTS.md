# src/cli — Command-Line Interface

> CLI entry point, command dispatch, shared helpers, and UI utilities.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| index.ts | index.ts | Main CLI entry — parses argv, dispatches to commands/ |
| helpers.ts | helpers.ts | Shared helper functions for CLI commands |
| ui-helpers.ts | ui-helpers.ts | Lightweight progress indicators and error recovery |

## Conventions

- - Commands are split across src/cli/commands/ for maintainability
- - No external CLI deps — uses Node.js built-ins

## Anti-Patterns

- - No business logic in CLI layer — delegate to core/ modules
