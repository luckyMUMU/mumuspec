---
layer: 0
scope: "."
last_updated: "2026-09-20"
prohibitions:
  - text: "禁止在无对应校验器时声称行为门把守"
    annotation:
      type: behavior-gate
      gate_ref: "error-code:E-BOGUS-999"
      rationale: "gate 指针核验单点变异"
---

## Requirement: Gate Dangling

### SHALL NOT
- 禁止在无对应校验器时声称行为门把守

### Enforcement
- ENF-1: manual(悬空即阻断由 E-GUARD-013 机器承担)
