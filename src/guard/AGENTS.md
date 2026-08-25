# src/guard — Constraint Guard Layer

> AST-based code checking, glossary drift detection, and phase guard enforcement.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| ast-checker.ts | ast-checker.ts | AST-based semantic analysis using TypeScript Compiler API |
| checker.ts | checker.ts | Constraint checking entry point |
| glossary-checker.ts | glossary-checker.ts | Terminology drift scanner for docs/skills/src |
| index.ts | index.ts | Barrel re-export of guard utilities |
| language-provider-registry.ts | language-provider-registry.ts | Runtime registration of AST providers |
| phase-guard.ts | phase-guard.ts | Phase transition enforcement (design→build→verify) |

## Conventions

- - AST checkers use TypeScript Compiler API — no regex-only checks
- - Guard results use structured GuardResult type

## Anti-Patterns

- - No `as any` in guard code — type safety is critical
- - No regex-based code checks — use AST for semantic analysis
