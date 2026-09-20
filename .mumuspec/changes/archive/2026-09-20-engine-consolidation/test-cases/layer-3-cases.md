# Layer 3 — 降档与决策面
## TC-L3-001 legacy 收敛
| 步骤 | 期望 |
|---|---|
| check --json coverage | legacy_weak ≤ 8；每条剩余项在 migration 清单有归类行 |
## TC-L3-002 advisory 与决策文档
| 步骤 | 期望 |
|---|---|
| mumuspec doctor | 输出含 legacy 兜底清单（actionable_weak 来源） |
| review/legacy-flip-decision-2026-09-20.md | 存在且含 breaking 分析与回退路径章节 |
## TC-L3-003 语义零丢失
| 步骤 | 期望 |
|---|---|
| 回写前后 SHALL/SHALL NOT 计数与约束正文 | 183/120 不变、正文逐字不变（仅 Enforcement/注解变化） |
