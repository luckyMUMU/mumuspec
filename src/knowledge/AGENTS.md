# src/knowledge — LLM-Wiki Knowledge Layer

> Progressive knowledge loading, LLM-Wiki memory index, UA-style analysis tools, and code scanners.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Knowledge CRUD/search | `pages.ts` | Page management, context loading |
| PageIndex management | `index.ts` | Index rebuild, reverse-index |
| LLM-Wiki memory | `memory.ts` | `_memory.yaml` index — L3 project summary + L2 scope-grouped memory |
| Freshness & verification | `freshness.ts` | Staleness, supersession, verification |
| Impact analysis | `analysis.ts` | Impact, coverage, onboarding, dashboard |
| Knowledge organize | `organize.ts` | Audit and auto-fix |
| Code scanners | `scanners/` | Extract knowledge from code |

## Key Concepts

- **Knowledge pages**: Markdown with YAML frontmatter (`id`, `title`, `type`, `status`, `scope`, `tags`, `graph_bindings`)
- **Page types**: `decision`, `pattern`, `risk`, `rationale`, `lesson`
- **Progressive loading**: By scope and freshness — AI loads only what's needed
- **LLM-Wiki Memory Index**: `_memory.yaml` provides L3 (project-level) and L2 (scope-level) summaries for design-time AI context
- **UA-style tools**: `analyze_impact`, `generate_onboarding_path`, `get_knowledge_coverage`, `find_knowledge_gaps`, `detect_decision_deviation`, `query_knowledge`

## Conventions

- Knowledge stored in `.mumuspec/knowledge/` as markdown files
- Knowledge subdirectories: `decisions/`, `patterns/`, `risks/`, `rationales/`, `lessons/`, `imports/`
- Index files: `_index.yaml` (page index), `_reverse-index.yaml` (code→page), `_memory.yaml` (LLM-Wiki memory)
- Frontmatter required: `id`, `title`, `type`, `status`, `scope`
- `graph_bindings` links knowledge to code nodes for traceability
- `_memory.yaml` auto-rebuilds when missing — provides compact summaries for AI consumption

## Anti-Patterns

- **No knowledge in code comments**: Knowledge lives in `.mumuspec/knowledge/`, not scattered in source
- **No stale pages**: Always verify freshness before using knowledge
- **No circular dependencies**: Knowledge pages should not reference each other circularly
