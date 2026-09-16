---
id: DS-EVAL-001
layer: 0
scope: .
delta: ADDED
---

## Requirement: corpus 场景类型与多信号 kill 判定

### SHALL
- SHALL eval runner 支持 corpus 场景类型：按 corpusDir 下每个 fixture 子目录作为独立 projectRoot 运行校验器，聚合输出 recall 与 noise 两比值。
- SHALL corpus 的 kill 判定采用多信号 diff：新增错误或警告码，或 coverage 五字段（total、enforced_strong、enforced_weak、manual、unverifiable）任一变化，均计为检出。
- SHALL 每格语料样本输出 Wilson 95% 置信区间，样本数不足 3 时标注置信不足。
- SHALL corpus 聚合区分 killed、missed、errored 三态：探针启动失败或输出不可解析的 fixture 计为 errored，不计入 recall 分母，并作为场景 warning 列明。
- SHALL 未声明聚合阈值 corpusExpect 时输出一条场景 warning 提示 report-only 模式，且不改变场景 passed 语义。
- SHALL 被声明的聚合阈值（minRecall、recallBySeverity、maxNoise）对应分母为 0 时报配置错误（计入场景错误，fail-closed）。
- SHALL corpusDir 下含 .mumuspec 子目录但缺 expected.yaml 的子目录发出 warning 并列明数量，且不计入任何分母。

### SHALL NOT
- SHALL NOT corpus 聚合与 kill 判定引入 LLM 判定或手写指标值。
- SHALL NOT 将探针启动失败或输出不可解析的 fixture 计为漏检。
- SHALL NOT 静默丢弃无 expected.yaml 声明的语料子目录。
- SHALL NOT 静默跳过已声明聚合阈值的断言。

Enforcement: eval-runner-corpus 词法锚点（corpus、recall、noise、coverage 字段名出现在 runner 实现与单测断言）；corpus 场景单测覆盖 killed、missed、errored 三态、空分母 fail-closed 与三条告警（report-only、errored 列明、无 expected.yaml 目录列明）。
