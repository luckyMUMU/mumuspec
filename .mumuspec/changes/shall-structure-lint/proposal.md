# Proposal: shall-structure-lint

## Why

机械四分类判定约束「是否有验证通道」，但不检查约束文本本身的**结构可判定性**——无界措辞（合理/适当/必要时/尽量等）让约束在 R3 manual 下永久通过，人审时也难以判定满足与否。SDD 生态对比（review/2026-09-13-sdd-ecosystem-comparison.md）中 Kiro 的 Analyze Requirements 用神经符号 AI 检测歧义；MumuSpec 的差异化路线是**机械可判定特征先行**：无界词检测不依赖 LLM，零误报成本可控。

## What

1. 新增 src/spec/structure-lint.ts：纯函数 lintConstraintText(text) 返回命中的无界限定词列表（初始词表：合理/适当/必要时/尽量/尽可能/酌情/视情况）。
2. validator.ts 在采集 ClassifiedItem 时逐条结构检查，命中项以新码 W-SPEC-016 STRUCTURE_VAGUE_QUALIFIER 发 warning（detail 含命中词与来源）。
3. W-SPEC-016 注册 ERROR_CODES（severity WARN，forceable: true——结构性建议不阻断，后续可视噪音率收紧）。

## Impact Scope

- src/spec/structure-lint.ts — 新增纯函数校验器
- src/spec/validator.ts — 接线（spec.md 与 tech.md 两条路径同批）
- src/core/errors.ts — W-SPEC-016 注册
- tests/ — 词表检测正反例 + validator 集成

## Acceptance Criteria

- 含无界词的约束在 validate 中产生 W-SPEC-016（含命中词）
- 干净约束零告警；should 类条目不检查
- ERROR_CODES 注册后文档可见（110→111 码）
- 三件套不回退，目标测试全绿

## Workflow

full
