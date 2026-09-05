---
id: KE-goal-p0-dispatch-gate-lessons
title: Lessons from goal-p0-dispatch-gate decisions
type: lesson
status: confirmed
scope: goal-p0-dispatch-gate
created_at: 2026-09-05
tags:
  - auto-extracted
  - lesson
  - decisions
  - goal-p0-dispatch-gate
graph_bindings: []
---
> Auto-extracted from goal-p0-dispatch-gate/decisions.md

# Decision Log: goal-p0-dispatch-gate


## [open] 2026-09-01T14:27:28.783Z

D1/C2 裁决：Rules 生成冲突策略=标记分路。托管文件（含 Auto-generated 标记头）幂等更新；用户手写文件跳过+警告，--force-rules 显式接管；doctor/check 对缺规范链文件打印保护降级警告。依据 review/goal-decision-briefing-2026-09-01.md

## [open] 2026-09-01T14:27:31.932Z

D2/C3 裁决：立即停止生成 .cursorrules/.windsurfrules，不建迁移命令（YAGNI）。停止生成不等于删除存量，永不自动删用户文件；doctor 一次性迁移提示 + release note 承担沟通。依据 review/goal-decision-briefing-2026-09-01.md

## [open] 2026-09-01T14:27:34.687Z

D3 裁决：存量变更处置=挂起容忍。loop-auto-evaluate 与 meta-spec-evolution 与 W0 影响域零交集，并存至 W0 归档；W1 开头收尾两旧变更；mumuspec status 对旧 schema（缺 build_layers）崩溃列为热修级容错小单；meta-spec-evolution 不 discard（工件齐全应归档提取知识）。依据 review/goal-decision-briefing-2026-09-01.md

## [open] 2026-09-01T14:27:37.168Z

D4 裁决：Wave 2 排序=完备性优先（W2-1 SHALL 自动化 → W2-2 反向通道 → W2-4 mumuspec next → W2-3 JIT 加载）。理由：LLM 判完备的可信度是修正后目标的承重墙；W2-4 依赖 W0-B 自然就绪后作低成本收尾。依据 review/goal-decision-briefing-2026-09-01.md

## [build] 2026-09-01T23:41:01.000Z

D5 裁决（build 期设计澄清）：渲染单一权威=install/rules-generator。Layer 2 盘点发现双渲染器漂移风险——新建 install/rules-generator（渲染+三态唯一权威，C2/D1 载体）与 CHG-3 存量 rules/generator（仍生成 .cursorrules、直接覆盖无三态）并存会导致 AGENTS.md 内容抖动。裁决：install/rules-generator 为渲染+三态唯一权威（decideAction/renderCanonicalRules/renderBridgeFile），rules/generator 降为胶水层（config/specContext → RuleGenContext → 计划 → 落盘 + agents-hash.json 漂移检测保留），依赖方向 rules→install 单向无环。依据：build 期一致性审计 + KP-0060 规则-实现分离（引擎归代码、规则归 LLM、校验归代码）。
