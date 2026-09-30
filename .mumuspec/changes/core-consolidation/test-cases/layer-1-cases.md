# Layer 1 — 起草覆盖面维度门
## TC-L1-001 维度身份判定
| 输入 | 期望 |
|---|---|
| entries 含 3 条 quadrant=Q4 且 category 全为 `concurrency` | `missing` 含 `security-compliance`；`converged` 为 false |
| entries 含 3 条 Q4 且 category 分属 `concurrency`/`compat`/`security-compliance` | `covered` 含该三者；`missing` 不含 `security-compliance` |
| entries 含 3 条 Q4 但 category 均为空 | `converged` 为 false（无身份记录不得算覆盖） |
## TC-L1-002 枚举单一事实源
| 场景 | 期望 |
|---|---|
| 读取 ASPECTS 常量 | 含 `security-compliance`，且不含 technical_design / requirement_goals（与强度维度正交） |
| design-schema 安全节 patterns 命中 `## 安全与隐私` / `## Security & Privacy` | 两者均判定为存在该节 |
## TC-L1-003 章节门
| 场景 | 期望 |
|---|---|
| full 工作流 design.md 缺安全节 | 报出 W-DESIGN-009，定位缺失节名 |
| hotfix / tweak 工作流缺同一节 | 不触发 |
| 该节存在但检查项未标注未决也未填写 | 计为缺失（留空与不写等价） |
## TC-L1-004 原文槽位兼容面
| 步骤 | 期望 |
|---|---|
| 不带原文输入创建变更 | 产物与基线逐字节一致，无 request.md |
| 带原文输入创建变更 | request.md 存在且内容与输入逐字节一致，不含派生或扩写内容 |
## TC-L1-005 W-DESIGN-005 改写
| 场景 | 期望 |
|---|---|
| 缺 2 个必需维度 | 描述与 fixSteps 列出这 2 个缺失维度名，不再出现"补充 N 个 entry"式行数指引 |
