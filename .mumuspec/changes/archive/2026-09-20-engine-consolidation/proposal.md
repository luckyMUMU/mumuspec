# Proposal: engine-consolidation

## Why
迁移批（dogfood-migration-b1）暴露引擎三处结构性不诚实，其偏差登记的根因项在引擎侧：
1. **假强制**：`lex:`/无标记的系统行为红线被 `isCoexistenceConstraint` 前缀豁免后**零执行**，却计入 enforced-weak（coverage 虚报强制面）；豁免判定以 `startsWith` 实现，任何通道前缀即破坏豁免（批1 实测 15 误报）。
2. **通道错位**：C 类门禁指针红线（--force 旁路、幽灵引用、遗留格式生成…）真正的把守者是错误码注册表/生成器硬过滤/语料杀伤，词法通道扫标识符既误报又没扫到点上；D 类 roadmap 数据约束被词法扫 src，语义无效。
3. **翻闸无决策面**：`legacy_lexical_channel` 默认 true 无 advisory、无 breaking 变更决策文档。

对应"人机合著统一设计基准"目标：基准的 coverage 数字必须诚实反映真实强制面——不可验证≈不存在，**假装可验证比不可验证更糟**。

## What
方案 A 三层收口（用户已选，设计 §1-§6 已分节获批；E-GUARD-013 恒不可 force 经用户显式确认）：
- **L1 根因修复**：`stripChannelMarker` 归一（豁免/agent 行为/词法入口先剥 `ast:`/`lex:` 标记），分类判定序不动。
- **L2 behavior-gate 契约变更**：`MachineReadableAnnotation.type` 追加 `'behavior-gate'` + `gate_ref`（`error-code:` / `corpus:` 两形态）；check 时静态核验指针（码已注册且有语料 mustContain 命中 / fixture 存在且声明非空）；命中⇒strong，悬空⇒新码 **E-GUARD-013 GATE_POINTER_UNRESOLVED（ERROR，forceable: false）**。gate 语义（验门禁存在而非自扫违规）写入 tech.md 契约变更节。
- **L3 诚实降档**：B 类→manual(单测指针)、D 类→manual(roadmap 校验器候选指针)；doctor 增 legacy advisory；翻闸决策文档落 review/，本轮默认值不动。roadmap 数据约束 validator 另立后续变更。

## Impact Scope
- .

## User Decisions
- [blocking] behavior-gate 指针悬空判 E-GUARD-013（ERROR），forceable: false，不可 --force 越过（用户显式确认）。
- [blocking] 翻闸拆两步且本轮不改 `legacy_lexical_channel` 默认值（breaking 变更仅出决策文档）。

## Workflow
full

## Workflow Path Recommendation
Recommended Path: full（cross_module 安全栅栏）
