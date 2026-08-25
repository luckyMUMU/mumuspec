# src/eval — Evaluation Runner

> Runs evaluation suites and collects metrics for self-improvement.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| runner.ts | runner.ts | Evaluation suite executor and metric collector |

## Conventions

- - Results are JSON-serializable for machine consumption

## Anti-Patterns

- - No side effects — evaluation runs are read-only
