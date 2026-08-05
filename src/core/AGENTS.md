# src/core — Foundation Module

> Core types, config, errors, utilities, project analysis, and init generation.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Type definitions | `types-*.ts` | One per domain: spec, contract, knowledge, constraint, env, analysis, loop, workflow |
| Config loading/saving | `config.ts`, `config-io.ts`, `config-tree.ts` | YAML-based `.mumuspec/config.yaml` |
| Error formatting | `errors.ts` | Structured codes: `E-<DOMAIN>-<NNN>` |
| Project analysis | `project-analyzer.ts` | Detects type, framework, language, CSS, tests |
| Init generation | `init-generator.ts`, `init-templates.ts` | Auto-generates specs, design, knowledge base |
| Spec scaffolding | `spec-scaffolder.ts` | `goal.md` and `env-spec.md` generation |
| Doc import | `doc-importer.ts` | Imports existing docs + third-party specs |
| Constraint evaluation | `constraint-evaluator.ts`, `constraints-loader.ts` | Dynamic constraint strength (high/medium/low) |
| Self-improvement loop | `loop-engine.ts`, `loop-grill.ts`, `phase-compressor.ts` | Feedback-driven spec refinement |
| Audit logging | `decision-audit.ts` | Change audit trail |
| Environment detection | `env-detector.ts` | Runtime environment detection |
| Skill loading | `skill-loader.ts` | Skill discovery and loading |
| Workflow recommendation | `workflow-recommender.ts` | Suggests workflow based on project state |

## Conventions

- All cross-module types imported via `../core/types-foo.js`
- Type files use `types-<domain>.ts` naming — never generic names
- Error codes follow `E-<DOMAIN>-<NNN>` format strictly
- No external runtime deps — only Node.js built-ins

## Anti-Patterns

- **No `as any` / `@ts-ignore`**: Strict mode + `noUnusedLocals` + `noUnusedParameters`
- **No new types in `types.ts`**: Domain-specific types go in their respective `types-*.ts`
- **No direct file I/O outside utils.ts**: All FS operations centralized in `utils.ts`
