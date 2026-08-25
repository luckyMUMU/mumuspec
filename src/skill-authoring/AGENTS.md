# src/skill-authoring — Skill Protocol

> Skill structure validation, content checking, and protocol enforcement.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| protocol.ts | protocol.ts | Skill validation: structure, content, protocol rules |

## Conventions

- - Skills follow SKILL.md format with frontmatter
- - Validation is strict — missing required fields are errors

## Anti-Patterns

- - No loose skill validation — all required fields must be present
