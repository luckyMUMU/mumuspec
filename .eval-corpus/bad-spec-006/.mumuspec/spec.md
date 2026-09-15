---
layer: 0
scope: "."
last_updated: "2026-09-15"
---

## Requirement: Audit Logging

### SHALL
- SHALL persist the audit log as a JSONL file named `audit.log`.
- SHALL append exactly one JSON object per audit entry.
- SHALL flush the audit log before the process exits.
- SHALL rotate the audit log when it exceeds 10 MiB.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)

## Requirement: Network Safety

### SHALL
- SHALL bound every outbound request with a timeout.
- SHALL retry a failed request at most 3 times.
- SHALL record the request id in the `audit.log`.

### SHALL NOT
- SHALL NOT perform unbounded retries on the network layer.
- SHALL NOT log credentials to the `audit.log`.

### Enforcement
- ENF-1: ast:checker --rule network-safety

## Requirement: Build Discipline

### SHALL
- SHALL keep the build deterministic across machines.
- SHALL pin dependency versions in the lockfile.

### SHALL NOT
- SHALL NOT commit generated artifacts into `src/`.
- SHALL NOT publish from a dirty working tree.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)

## Requirement: Data Integrity

### SHALL
- SHALL validate every input against its schema before use.
- SHALL reject a structurally invalid document with an error.
- SHALL preserve unknown fields when re-serializing.

### SHALL NOT
- SHALL NOT silently drop fields during migration.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)

## Requirement: Documentation

### SHALL
- SHALL document every public function with a docstring.
- SHALL keep the changelog current for each release.

### SHALL NOT
- SHALL NOT reference deprecated APIs in `docs/`.

### Enforcement
- ENF-1: manual(reviewed by the spec owner)
