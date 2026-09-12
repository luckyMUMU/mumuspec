---
id: KE-skill-plugin-standard-q4-risk
title: Residual risks from skill-plugin-standard
type: risk
status: confirmed
scope: skill-plugin-standard
created_at: 2026-09-12
tags:
  - auto-extracted
  - q4
  - risk
  - skill-plugin-standard
graph_bindings: []
---
> Auto-extracted from skill-plugin-standard cognitive-map Q4

- **隐藏耦合维度：新模块间是否存在未识别的调用边？**: 已扫描。唯一风险边为 skill-drift → src/install，设计阶段已切断（纯函数 + 注入）。 其余新模块依赖方向单向（cli → install/guard → bundle → core），无环。
- **规范继承冲突维度：新 SHALL NOT 是否派生语义无关的词法通道？**: 已扫描并规避：全部 SHALL NOT 不使用行内代码标记承载对象标识符，改由块级 Enforcement 走 R3 manual。实测 validate unverifiable 保持 0。
- **契约束兼容性维度：哪些既有消费者会因本变更改变行为？**: publishBundle 语义变更（1 处测试断言）；WORKBUDDY_PACKAGES 结构变更（1 处结构测试）； stampSkillVersion 口径变更（1 处测试）。均已在 impact-analysis 登记并排入测试改写。
- **外部写入者维度：如何防止在途工件被再次静默丢弃？**: 无法阻止外部进程，但可改变自身暴露面：每阶段完成即 git commit（已跟踪文件才可恢复）； 恢复一律走 CLI 重放而非手工编辑；每步前后校验 decisions_log.content_hash。 残余风险：commit 与外部 merge 之间的窗口仍可能丢一次。