---
name: mumuspec-workflow
description: "Drive AI-assisted development through the MumuSpec spec-as-DSL change lifecycle: open → design → build → verify → archive. Use when the user asks to start a change, write/review a spec or design, run phase guards, check compliance or drift, or archive a completed change in a MumuSpec-managed repository (marked by .mumuspec/)."
license: MIT
metadata:
  author: MumuSpec Contributors
  version: 0.24.0-alpha.0
  homepage: https://github.com/mumuspec/mumuspec
---

# MumuSpec Workflow

MumuSpec is a spec-as-DSL harness: the spec tree (`.mumuspec/`) is the source of
truth for WHAT, external skills decide HOW, and the Guard Layer enforces
constraints with exit codes. This skill teaches an agent to operate the
lifecycle correctly.

## Core invariants (never violate)

1. **Design decisions belong to the human.** Draft artifacts (proposal, design,
   open-questions, assumptions) for review; never self-approve a blocking point
   (BP gate) — the human signs off via `decisions.md` anchors or explicit
   confirmation.
2. **Single active change** per scope/branch (`mumuspec new` enforces it).
3. **Top-down design, bottom-up implementation**: root directories first in
   design, leaf directories first in build.
4. **Test cases are design output**: locked after the Design phase; edits
   during Build are a process violation (W-GUARD-004).
5. **SHALL NOT constraints are hard**: exit-code failures from
   `mumuspec check` / `guard` must be fixed, not argued around.

## Lifecycle quick reference

| Phase | You do | Exit gate (hard) |
|-------|--------|------------------|
| open | `mumuspec new <name>`; write proposal.md; log decisions | proposal.md non-empty (E-CHANGE-*) |
| design | Write design.md; draft open-questions.yaml; propose test cases | completeness gate on open-questions.yaml (fail-closed); design.md exists |
| build | Implement bottom-up per parallel group; run `mumuspec guard <change> verify` (`<phase>` is the TARGET phase) | all build_layers done (E-GUARD-002); same-layer coupling (W-BUILD-001); assumptions.yaml gate (full workflow) |
| verify | Run tests; `mumuspec check`; `mumuspec drift`; fix or record drift | verify_result=pass (E-VERIFY-001); branch handled (E-VERIFY-002) |
| archive | `mumuspec archive <name> --confirm` | BP-17 human confirmation |

Presets: `hotfix` / `tweak` skip the design phase (open → build shortcut).

## Command cheatsheet

```bash
mumuspec new <name>            # create change (single active change enforced)
mumuspec status [name]         # current phase, layers, counters
mumuspec guard <name> <target-phase>  # phase-gate check (use --apply to transition; <phase> is the TARGET phase)
mumuspec validate              # spec format validation
mumuspec check                 # compliance + drift + glossary (exit code = verdict)
mumuspec drift [--change <n>]  # spec↔code drift detection (--fix for auto-fix)
mumuspec context <path>        # progressive-disclosure spec context
mumuspec archive <name> --confirm
```

MCP equivalent: `mumuspec-mcp` exposes 38 read/validate tools
(get_spec_context, check_compliance, detect_drift, guard_check, ...). Writes
(new/transition/archive) stay on the CLI by design.

## Error-code discipline

Every guard/validation failure carries an error code (`E-CHANGE-*`,
`E-GUARD-*`, `E-VERIFY-*`, `E-SPEC-*`, `E-AGENTS-*`). Read the code, apply the
printed fixHint, re-run the gate. Never mark a gate passed without the check
that proves it; warnings (W-*) are advisory and must be reported to the human,
not silently ignored.

## When something does not fit

- Spec unclear → ask the human; record the answer in `decisions.md`
  (`## [phase] timestamp` anchor). Do not invent requirements.
- Constraint blocks the task → stop and surface the conflict; exceptions go
  through `constraint_strength` overrides, not silent workarounds.
- No active change but work is requested → run `mumuspec new`; free-floating
  edits bypass every guarantee above.
