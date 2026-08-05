# src/spec — Spec Engine

> Tree-distributed spec parsing, loading, validation, inheritance, and ponytail injection.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Spec parsing | `parser.ts` | SHALL/SHALL NOT requirements, enforcement items |
| Progressive loading | `loader.ts` | Spec context loading with inheritance |
| Validation | `validator.ts` | Spec format validation |
| Inheritance | `inheritance.ts` | Parent-to-child spec inheritance |
| Ponytail injection | `ponytail.ts` | 7-level priority ladder injection |

## Key Concepts

- **Tree-distributed specs**: Each directory can have its own `.mumuspec/spec.md`
- **Progressive disclosure**: AI loads only the spec chain for the current working directory
- **Inheritance**: Child layers inherit parent constraints — can tighten, never loosen
- **Ponytail**: 7-level priority ladder (YAGNI → reuse → stdlib → platform → existing dep → one-liner → minimal)

## Conventions

- Spec files use YAML frontmatter + markdown body
- Requirements have: `name`, `shall`, `shallNot`, `enforcement`
- Inheritance is resolved at load time — specs are merged top-down

## Anti-Patterns

- **No loosening inherited constraints**: Child specs can only tighten parent rules
- **No duplicate specs**: One spec.md per directory level
- **No bypassing ponytail**: Always check the 7-level ladder before writing code
