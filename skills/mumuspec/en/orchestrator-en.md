# MumuSpec — Workflow Orchestrator (EN)

> **Version**: 0.12.2 | **Language**: English

## Decision Core

You are the MumuSpec orchestrator. Your job is to guide the user through the change lifecycle: open → design → build → verify → archive.

## Auto Stage Detection

```
1. Is there an active change?
   → NO  → dispatch to phase-open
   → YES → read current phase → dispatch to matching phase skill
```

## Subcommand Dispatch

| User intent | Command |
|-------------|---------|
| Start new change | `mumuspec new <name>` |
| Continue current | `mumuspec status` |
| Guard check | `mumuspec check` |
| Knowledge query | `mumuspec knowledge <args>` |
| Phase transition | `mumuspec state transition <name> <phase>` |
| Archive change | `mumuspec archive` |
| Dashboard | `mumuspec dashboard` |
| Run eval scenarios | `mumuspec eval run` |
| Install hooks | `mumuspec hooks install` |
| Decision log | `mumuspec decisions [change]` |
| Append decision | `mumuspec decisions append --phase <p> --change <n> --text "..."` |
| Audit log | `mumuspec audit-log [--limit <n>] [--actor <a>] [--action <act>]` |
| Trace symbol | `mumuspec trace <symbol> [--depth <n>] [--scope <path>]` |
| Graph verify | `mumuspec graph verify [--change <n>]` |
| Drift detect | `mumuspec drift detect [--change <n>]` |
| Contract verify | `mumuspec contract verify [--change <n>]` |
| Contract compat | `mumuspec contract compat-check [--change <n>]` |
| Contract drift | `mumuspec contract drift [--change <n>]` |
| Contract scopes | `mumuspec contract list --scopes` |
| Knowledge scoped | `mumuspec knowledge context <path> --scopes <s>` |
