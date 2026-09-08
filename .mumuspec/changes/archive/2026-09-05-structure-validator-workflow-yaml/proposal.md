# Proposal: structure-validator-workflow-yaml

## Why
CHG-6/CHG-7 将阶段状态机外化为声明式 workflow YAML 后，项目级 override 文件
`.mumuspec/workflow.yaml` 成为合法根级文件（根 spec.md TEMP-4 白名单已收录），
但 `src/spec/structure-validator.ts` 的 `DEFINED_FILES` 硬编码白名单未同步，
导致每个已落地 workflow.yaml 的项目在 `mumuspec validate` 时恒报
E-SPEC-014 UNDEFINED_MUMUSPEC_FILE（ERROR）——本仓库自身（dogfood）即触发。

## What
- `DEFINED_FILES` 增加 `workflow.yaml`（含 CHG-6/7 来源注释）。
- 版本号语义化增量：0.19.2-alpha.0 → 0.19.2-alpha.1（bugfix）。

## Impact Scope
- `src/spec/structure-validator.ts`（+1 行白名单条目）
- `package.json`（版本号）
- 无行为面变化：仅消除已声明合法文件的误报。

## Workflow
tweak
