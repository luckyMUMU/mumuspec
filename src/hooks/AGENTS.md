# src/hooks — Git Hooks

> Git hook integration for pre-commit and pre-push constraint enforcement.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| guard.ts | guard.ts | Git hook entry — delegates to guard/checker |

## Conventions

- - Hooks are shell scripts that call `mumuspec check`

## Anti-Patterns

- - No blocking hooks without user-visible error messages
