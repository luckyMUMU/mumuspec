---
id: KE-dogfood-migration-b1-patterns
title: Architecture patterns from dogfood-migration-b1
type: pattern
status: confirmed
scope: dogfood-migration-b1
created_at: 2026-09-19
tags:
  - auto-extracted
  - pattern
  - architecture
  - dogfood-migration-b1
graph_bindings: []
---
> Auto-extracted from dogfood-migration-b1/design.md

# Design: dogfood-migration-b1

## 迁移规则（决策一/二的具体化）
机械三分法，逐条可核对，不做语义猜测式升档：
1. **annotation 候选**：条目文本语义与既有 MachineReadableAnnotation 类型真实对应（判定依据=文本明示"依赖/全局状态/可变状态/纯函数/副作用"语义且检查器有对应 AST 规则）→ 手写 frontmatter `prohibitions` 注解（SHALL NOT）或 `ast:` 前缀。
2. **lex 显式化**：现经 legacy 词法兜底判 weak 的 21 条（`legacy_weak` 清单）→ 文本前加显式 `lex:` 前缀；行内代码标识符误报风险者（红线：行内码承载标识符）不升级、转显式 manual。
3. **显式 manual(reason)**：其余 implicit-manual（Enforcement 自由文本行）→ 改写为 `ENF-n: manual(<原文所载核验方式>)`，原文信息零丢失（决策：宁缺勿错配；不发明核验方式，reason 取该行既有描述）。

## 批次与签收
- 批 1：根 `.mumuspec/spec.md`（248 manual + 21 legacy weak 中属根者）
- 批 2：`.mumuspec/roadmap/spec.md`（35）
- 批 3：`.mumuspec/constraints.yaml`（12）
每批先产出 `migration/<batch>-mapping.md` 逐条清单（条目原文 → 处置 + 依据），经用户签收后回写；回写后立即 `validate` + `check` + `regen-rules`。

## 兼容与红线
- 分类判定序不改、不新增注解类型/引擎；E-SPEC-004/015 语义不动。
- 回写只动 Enforcement 声明与文本前缀，不触碰约束正文语义。
- 验收后跑 `legacy_lexical_channel:false` 演练（临时 config，验证后还原），`check` 须 exit 0。
- STATUS 运行时字段 coverage 数字更新（对账通道保真）。

## 完成判据
- `legacy_weak=0`；根/roadmap/constraints 三处 `implicit-manual=0`（W-SPEC-017 零触发）。
- 演练 legacy=false 时 check exit 0 且 unverifiable=0。
- 全量测试、eval-corpus、ci-check 不回退。
