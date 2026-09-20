---
layer: 0
scope: "."
last_updated: "2026-09-20"
prohibitions:
  - text: "禁止 frontmatter 缺失 scope 字段进入规范面"
    annotation:
      type: behavior-gate
      gate_ref: "error-code:E-SPEC-001"
      rationale: "由 E-SPEC-001 格式门禁把守，语料 gate-evidence 声明杀伤"
---

## Requirement: Gate Valid

### SHALL NOT
- 禁止 frontmatter 缺失 scope 字段进入规范面

### Enforcement
- ENF-1: manual(净样本对照由 E-GUARD-013 零触发机器承担)
