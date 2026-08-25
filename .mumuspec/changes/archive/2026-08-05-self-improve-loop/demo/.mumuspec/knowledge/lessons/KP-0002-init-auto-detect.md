---
id: "KP-0002"
title: "Initialization workflow: auto-detect project characteristics"
type: lesson
status: confirmed
scope: "global"
tags:
  - init
  - workflow
  - auto-detect
created_at: "2026-08-04T16:42:14.445Z"
verified_at: "2026-08-04T16:42:14.445Z"
freshness: fresh
---

# Init Auto-Detect Lesson

## Context

When running `mumuspec init`, the project is analyzed automatically to generate appropriate specs, designs, and knowledge base.

## What Was Learned

1. Detect project type from `package.json` dependencies
2. Identify framework-specific patterns
3. Generate tailored spec entries (TypeScript, framework best practices, testing)
4. Create initial design document based on source structure
5. For frontend projects: generate `DESIGN.md` style guide at project root

## Recommendations

- Review generated spec.md after init and customize
- Update generated design.md after architectural decisions are made
- Add project-specific knowledge pages as development proceeds
