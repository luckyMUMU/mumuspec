---
layer: 0
scope: "."
last_updated: "2026-09-15"
---

## Requirement: CLI Ergonomics

### SHALL
- SHALL print a usage summary on `--help`.
- SHALL exit with status 0 on success.

### SHALL NOT
- SHALL NOT print stack traces to `stdout`.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)

## Requirement: Error Reporting

### SHALL
- SHALL include a stable `code` in every error.
- SHALL include a remediation hint for actionable errors.

### SHALL NOT
- SHALL NOT leak file system paths in `stderr`.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)
