# src/feedback — Feedback Manager

> User feedback collection, session summarization, and query.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| manager.ts | manager.ts | submitFeedback(), session summaries, feedback query |

## Conventions

- - Feedback is persisted to .mumuspec/feedback/
- - Sessions are correlated by timestamp + change name

## Anti-Patterns

- - No feedback deletion — feedback is append-only
