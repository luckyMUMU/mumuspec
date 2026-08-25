# src/bundle — Packaging Module

> Builds distributable bundles (ncc-style single-file output).

## Where to Look

| Task | File | Notes |
|------|------|-------|
| packager.ts | packager.ts | Bundles src/ into a single distributable file |

## Conventions

- - No external bundler deps — uses ncc or manual concatenation

## Anti-Patterns

- - No runtime deps in bundle output
