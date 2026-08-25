# src/install — Agent Installer

> Installs MumuSpec rules, MCP servers, and command presets for supported AI agents.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| installer.ts | installer.ts | Barrel re-export hub |
| installer-registry.ts | installer-registry.ts | Agent manifests, MCP presets, shared types |
| installer-ops.ts | installer-ops.ts | Core install operations for packages, MCP, commands |

## Conventions

- - Agent types are registry-driven — add new agents via registry
- - MCP server config uses standard JSON format

## Anti-Patterns

- - No agent-specific logic outside registry — all agents are data-driven
