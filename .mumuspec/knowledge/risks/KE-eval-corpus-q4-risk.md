---
id: KE-eval-corpus-q4-risk
title: Residual risks from eval-corpus
type: risk
status: confirmed
scope: eval-corpus
created_at: 2026-09-17
tags:
  - auto-extracted
  - q4
  - risk
  - eval-corpus
graph_bindings: []
---
> Auto-extracted from eval-corpus cognitive-map Q4

- **Q4-001 隐藏耦合: corpus fixture 运行会触发 findProjectRoot 向上查找**: fixture 子目录自身含 .mumuspec 即命中；但 fixture 嵌套在 .eval-corpus 下时 findProjectRoot 从 cwd 起查——runner 须显式传 projectRoot 绝对路径，不依赖 cwd 推断；兜底：单测断言无 cwd 依赖
- **Q4-002 测试盲区: Wilson CI 在 n=0（语料为空目录）时的除零**: 空 corpus 目录返回 nullResult（value 0 + details 说明），不抛异常；与 design-build-first-pass 的 nullResult 模式一致
- **Q4-003 契约兼容: eval --report 输出被 CI 或外部脚本消费的未来面**: M1 阶段 --report 为新增旗标，无既有消费者；JSON 形态自本版起冻结为事实契约，后续扩展只加字段不改性——写入 design 风险章节