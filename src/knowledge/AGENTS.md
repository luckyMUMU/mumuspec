# src/knowledge — LLM-Wiki Knowledge Layer

> Progressive knowledge loading, UA-style analysis tools, and code scanners.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Knowledge CRUD/search | `manager.ts` | Page management, context loading, impact analysis |
| Code scanners | `scanners/` | Extract knowledge from code |

## Key Concepts

- **Knowledge pages**: Markdown with YAML frontmatter (`id`, `title`, `type`, `status`, `scope`, `tags`, `graph_bindings`)
- **Page types**: `decision`, `pattern`, `risk`, `rationale`, `lesson`
- **Progressive loading**: By scope and freshness — AI loads only what's needed
- **UA-style tools**: `analyze_impact`, `generate_onboarding_path`, `get_knowledge_coverage`, `find_knowledge_gaps`, `detect_decision_deviation`, `query_knowledge`

## Conventions

- Knowledge stored in `.mumuspec/knowledge/` as markdown files
- Frontmatter required: `id`, `title`, `type`, `status`, `scope`
- `graph_bindings` links knowledge to code nodes for traceability

## Anti-Patterns

- **No knowledge in code comments**: Knowledge lives in `.mumuspec/knowledge/`, not scattered in source
- **No stale pages**: Always verify freshness before using knowledge
- **No circular dependencies**: Knowledge pages should not reference each other circularly
