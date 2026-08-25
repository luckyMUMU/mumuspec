# src/cli/commands — CLI Command Modules

> 31 command module files registered via commander in `src/cli/index.ts`.

## Where to Look

| Command | File | Notes |
|---------|------|-------|
| `mumuspec advise` | `advise.ts` | Best practice advice |
| `mumuspec bundle` | `bundle.ts` | Skill packaging |
| `mumuspec new/status/list/archive/discard` | `change.ts` | Change lifecycle management |
| `mumuspec constraints` | `constraints.ts` | Dynamic constraint strength |
| `mumuspec contract` | `contract.ts` | Contract registry management |
| `mumuspec dashboard` | `dashboard.ts` | Status dashboard |
| `mumuspec decisions` | `decisions.ts` | Decision log management |
| `mumuspec doctor` | `doctor.ts` | Environment diagnostics |
| `mumuspec env` | `env.ts` | Environment detection |
| `mumuspec eval` | `eval.ts` | Evaluation scenario runner |
| `mumuspec feedback` | `feedback.ts` | User feedback management |
| `mumuspec finalize-archive` | `finalize-archive.ts` | Post-archive cleanup |
| `mumuspec guard` | `guard.ts` | Phase guard check |
| `mumuspec hooks` | `hooks.ts` | Git hooks management |
| `mumuspec i18n` | `i18n.ts` | Internationalization settings |
| `mumuspec install` | `install.ts` | AI tool skill installer |
| `mumuspec knowledge` + sub-commands | `knowledge.ts`, `knowledge-*.ts` | Knowledge CRUD, analysis, chat, scan, onboard |
| `mumuspec loop` | `loop.ts` | Self-improvement loop |
| `mumuspec recommend` | `recommend.ts` | Workflow recommendation |
| `mumuspec review` | `review.ts` | Code review |
| `mumuspec skill` | `skill.ts` | Skill authoring |
| `mumuspec spec` | `spec.ts` | Spec management |
| `mumuspec state` | `state.ts` | State machine management |
| `mumuspec sync` | `sync.ts` | Code-to-spec sync |

## Conventions

- Each file exports a `register<X>Commands(program: Command)` function
- Register all commands in `src/cli/index.ts`
- Knowledge sub-commands (`knowledge-*.ts`) are nested under the `knowledge` parent command
- Use `commander` for argument parsing and help generation

## Anti-Patterns

- **No logic in command registration**: Commands should delegate to business logic modules
- **No direct FS operations**: Use `src/core/utils.ts` helpers
- **No new dependencies**: Only `commander` + existing runtime deps
