# Meta-Evolution Policy

## 进化策略

### 保守策略（默认）
- penalty_weight: 1.5（误报惩罚偏重）
- low_score_threshold: 0.3（低评分阈值）
- min_sample_size: 5（最小样本量）
- 仅建议，不自动应用（需人工确认）

### 激进策略
- penalty_weight: 1.0（误报惩罚减轻）
- low_score_threshold: 0.2（更严格检测）
- 仍保留 Goal Preservation 门

## Goal Preservation 约束

以下条目**不可**被 meta-evolve 修改：
- `always_enforce: true` 的约束条目
- `SHALL NOT` 类别中的核心规范（E-GUARD-003 等）
- 涉及安全、审计完整性的条目

## 影响分析要求

`--apply` 执行前必须：
1. 列出将被修改的文件路径
2. 列出将被修改的约束条目 ID
3. 标注 Goal Preservation 过滤掉的条目
4. 用户显式 `--confirm` 确认
5. 记录到 decisions.md 审计日志
