# Proposal: enhance-design-phase

## Summary
强化 MumuSpec 的 Design 阶段，引入结构化设计模板、澄清循环、AI 自审协议、跨工件一致性检查和任务粒度规范，使设计文档从"一次性产物"升级为"可执行规范"。

## Scope
- src/guard/phase-guard.ts — 扩展设计阶段校验逻辑
- src/cli.ts — 新增 clarify 命令
- src/change/manager.ts — 扩展设计阶段工件管理
- src/core/types.ts — 扩展设计相关状态字段
- templates/ — 新增设计模板文件

## Motivation
经评价发现当前 Design 阶段存在 5 个核心问题：
1. 模板自由格式 — 无强制字段，质量参差不齐
2. 无澄清循环 — AI 直接生成设计，从不消除歧义
3. 无 AI 自审 — 设计文档无质量检查
4. 无一致性校验 — design 与 proposal 可能不一致
5. 任务粒度无约束 — hyperplan 任务可能不可执行

业界对标（GitHub Spec Kit、OpenSpec、AWS Kiro）均具备上述能力。

## Requirements

### FR-001: 结构化设计模板
- 强制 8 个字段：API Contracts、Data Flow、Error Specification、Architecture、Implementation Layers、Constraints Analysis、Risk Mitigation、Test Strategy
- 缺失任一段落时 guard 返回 E-DESIGN-009
- tweak 预设可使用轻量模板（仅保留 Architecture + Layers + Test Strategy）

### FR-002: 澄清循环 (Clarify)
- 新增 CLI 命令 `mumuspec clarify <change-name>`
- 分析 proposal 中的模糊描述、缺失信息、矛盾点
- 生成最多 5 个澄清问题供用户回答
- 答案整合到 design.md 的 Constraints Analysis 中
- 澄清记录存储在 clarification-log.md

### FR-003: AI 自审协议
- 设计完成后自动生成 design-review.md
- 检查维度：完整性、一致性、接口匹配、风险闭环、约束可行、测试可执行
- 分级：CRITICAL（阻塞）、MAJOR（警告）、MINAR（提示）

### FR-004: 跨工件一致性检查
- guard --apply 时自动执行
- 检查 design.md ↔ proposal.md ↔ cognitive-map ↔ delta-specs 的一致性
- 不一致时返回 E-DESIGN-010 并列出差异

### FR-005: 任务粒度规范
- hyperplan 任务粒度约束：2-15 min/任务
- 超过 15 min 的任务返回 W-DESIGN-001 警告
- 提供任务拆分建议

## Plan
1. 扩展 types.ts 添加设计阶段新字段
2. 更新 phase-guard.ts 添加 E-DESIGN-009/010 新错误码
3. 实现 clarify 命令核心逻辑
4. 新增设计模板文件 templates/design-template.md
5. 更新 CLI 测试覆盖新命令

## Risks
- 结构化模板可能增加小变更的编辑成本 → 通过 tweak preset 缓解
- 澄清循环增加交互次数 → 支持批量回答
- AI 自审可能产生误报 → 分级处理，仅 CRITICAL 阻塞

## Non-Goals
- 不修改 Build/Verify/Archive 阶段的现有逻辑
- 不引入新的外部依赖（使用现有 yaml 库）
- 不改变现有的 YAML 状态文件格式（向后兼容）
