# Test Cases: manual-explicit (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 implicit-manual 迁移提示（positive）

- 前置：spec 含 `### Enforcement` 自由文本（legacy，kind=implicit-manual）；SHALL 条目。
- 步骤：`validateSpecMd` 分类 + 发放。
- 期望：条目仍为 `manual`；新增 `W-SPEC-017` advisory；无 error；E-SPEC-004/015 不因此变化。

## TC-L0-02 显式 manual(reason) 无提示（positive / 回归）

- 前置：`- ENF-1: manual(人工核对)`。
- 步骤：同上。
- 期望：`explicitManual === true`，无 W-SPEC-017。

## TC-L0-03 结构化证据匹配（positive）

- 前置：enforcementId=ENF-1 的 manual 条目；verify 内容含 `- {constraintId: "ENF-1", user: "alice", verdict: "pass", timestamp: "2026-09-18", evidence_hash: "abc123"}`。
- 步骤：`missingManualEvidence`。
- 期望：不判为缺失（结构匹配按 id 命中）。

## TC-L0-04 无结构化记录回落文本锚点（回归）

- 前置：verify 内容仅含 `ENF-1 已由 code review 覆盖。`。
- 步骤：`missingManualEvidence`。
- 期望：既有文本锚点逻辑命中，不判为缺失（行为不变）。

## TC-L0-05 classifyConstraintEntry 三分（positive）

- 前置：entry enforcement 空 + content 含引号词 `\`eval\`` → enforced-weak；content 无引号词 → unverifiable；`manual(...)` → manual。
- 步骤：`classifyConstraintEntry`。
- 期望：三分正确。