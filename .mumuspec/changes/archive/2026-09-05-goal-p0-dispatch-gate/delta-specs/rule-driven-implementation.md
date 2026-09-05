# Delta Spec: 规则-实现分离（Rule-Driven Implementation）

> 依据 KP-0060。归档时合并进根 spec.md，与「流程执行载体（CLI-first）」块同构，作为其一般化上位原则。

## Requirement: 规则-实现分离

### SHALL

- 凡给定规则后可由工具确定性实现的相对固定部分，必须由代码实现；LLM 仅创建声明式规则（spec、delta-specs、workflow yaml、结构化工件、模板填充内容）。
- 代码在消费 LLM 创建的规则前必须执行校验（schema + 语义），校验失败必须拒绝执行并产出诊断错误码。
- 新增确定性能力的实现顺序必须为：先规则 schema 与校验器，再引擎消费，最后 skill / LLM 指引。
- LLM 决策域保留为：规则创作、歧义澄清（grill-me 问答）、设计创作、对抗审查、偏差接受建议。

### SHALL NOT

- 禁止将相对固定的执行逻辑以 LLM 现场发挥方式实现（LLM 不充当引擎）。
- 禁止在无对应校验器的情况下引入新的 LLM 结构化产出物（先校验器后消费者）。
- 禁止代码静默消费校验失败的规则（fail-open）。

### Enforcement

- F-1: 既有实例——可验证性四分类校验器（verifier-classify）+ E-SPEC-015 红线未声明验证方式恒 block
- F-2: 既有实例——状态机边校验拒绝无效目标阶段（E-CHANGE-006）与受保护字段审计（E-STATE-001）
- F-3: 本变更新增实例——分发层生成器以声明式配置为输入、生成物经代码校验；完备性门禁 schema 校验器拒绝非法 open-questions / assumptions 工件（见 delta-specs/completeness-gate.md ENF-1/ENF-2）
- F-4: drift / CI 校验覆盖新增规则 schema，防止规则与校验器漂移
